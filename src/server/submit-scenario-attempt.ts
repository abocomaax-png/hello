import { createServerFn } from "@tanstack/react-start";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type {
  AttemptResultLine,
  QuestionResultLine,
} from "@/integrations/firebase/types";

// ---------------------------------------------------------------------------
// This file — and everything it imports (firebase-admin in particular) —
// only ever runs on the server. TanStack Start compiles createServerFn
// handlers into their own server bundle and replaces client-side usage with
// a small fetch() call, so none of this code or its admin credentials ever
// reach the browser. On Vercel (nitro "vercel" preset, see vite.config.ts)
// each server function is deployed as its own serverless function — same
// deployment as the rest of the site, no separate service to manage.
//
// This replaces the old `submitScenarioAttempt` Firebase Cloud Function.
// The security guarantee is identical: a trainee's browser can never read
// `answers` / `questionAnswers` (Firestore rules block it — see
// firestore.rules) and can never write to `attempts` or their own `xp`
// (rules should restrict those to server/admin writes too). The only way to
// get graded is through this handler, which runs with Admin SDK privileges
// that bypass Firestore rules entirely, verifies the caller's Firebase ID
// token itself (since there's no Functions-style auth context here), and is
// the sole place that computes scores and writes attempts/XP.
//
// Firestore Admin SDK access via a service account is free on Firebase's
// Spark (no-cost) plan — Blaze is only required for things like Cloud
// Functions' outbound networking, not for reading/writing Firestore with a
// service account from your own server.
// ---------------------------------------------------------------------------

function adminApp() {
  if (getApps().length) return getApps()[0]!;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY " +
        "server environment variable(s). Set them in your Vercel project's " +
        "Environment Variables (Production + Preview) — get the values from " +
        "Firebase Console → Project Settings → Service Accounts → Generate " +
        "new private key. Do NOT prefix these with VITE_ — they must stay " +
        "server-only.",
    );
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

type SubmitAttemptInput = {
  idToken: string;
  scenarioId: string;
  answers: Array<{ logId: string; markedMalicious: boolean }>;
  questionAnswers: Array<{ questionId: string; answerText: string }>;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const submitScenarioAttempt = createServerFn({ method: "POST" })
  .validator((data: SubmitAttemptInput) => data)
  .handler(async ({ data }) => {
    const app = adminApp();
    const db = getFirestore(app);

    let uid: string;
    try {
      uid = (await getAuth(app).verifyIdToken(data.idToken)).uid;
    } catch {
      throw new Error("unauthenticated: Must be signed in");
    }

    const { scenarioId, answers, questionAnswers } = data;
    if (
      !scenarioId ||
      !Array.isArray(answers) ||
      !Array.isArray(questionAnswers)
    ) {
      throw new Error(
        "invalid-argument: scenarioId, answers[] and questionAnswers[] are required",
      );
    }

    const scenarioSnap = await db.doc(`scenarios/${scenarioId}`).get();
    if (!scenarioSnap.exists || scenarioSnap.data()?.isPublished !== true) {
      throw new Error("not-found: Scenario not found or not published");
    }
    const scenario = scenarioSnap.data()!;

    const [answersSnap, questionsSnap, questionAnswersSnap] = await Promise.all(
      [
        db.collection(`scenarios/${scenarioId}/answers`).get(),
        db.collection(`scenarios/${scenarioId}/questions`).get(),
        db.collection(`scenarios/${scenarioId}/questionAnswers`).get(),
      ],
    );
    if (answersSnap.empty) {
      throw new Error(
        "failed-precondition: Scenario has no answer key configured yet",
      );
    }

    // Grade the flagged log lines.
    const submittedLogs = new Map(
      answers.map((a) => [a.logId, !!a.markedMalicious]),
    );
    let correctLogCount = 0;
    const results: AttemptResultLine[] = [];
    for (const answerDoc of answersSnap.docs) {
      const logId = answerDoc.id;
      const d = answerDoc.data();
      const isMalicious = !!d.isMalicious;
      const markedMalicious = submittedLogs.get(logId) ?? false;
      const correct = markedMalicious === isMalicious;
      if (correct) correctLogCount++;
      results.push({
        logId,
        markedMalicious,
        isMalicious,
        correct,
        mitre: (d.mitre as string | null) ?? null,
        explanation: (d.explanation as string) ?? "",
      });
    }

    // Grade the debrief questions (case-insensitive, whitespace-normalized
    // exact match).
    const questionTextById = new Map(
      questionsSnap.docs.map((d) => [d.id, (d.data().text as string) ?? ""]),
    );
    const submittedQuestions = new Map(
      questionAnswers.map((q) => [q.questionId, (q.answerText ?? "").trim()]),
    );
    let correctQuestionCount = 0;
    const questionResults: QuestionResultLine[] = [];
    for (const qaDoc of questionAnswersSnap.docs) {
      const questionId = qaDoc.id;
      const correctAnswer = (qaDoc.data().answer as string) ?? "";
      const submittedAnswer = submittedQuestions.get(questionId) ?? "";
      const correct =
        normalize(correctAnswer) !== "" &&
        normalize(submittedAnswer) === normalize(correctAnswer);
      if (correct) correctQuestionCount++;
      questionResults.push({
        questionId,
        question: questionTextById.get(questionId) ?? "",
        submittedAnswer,
        correctAnswer,
        correct,
      });
    }

    const totalCount = answersSnap.size + questionAnswersSnap.size;
    const correctCount = correctLogCount + correctQuestionCount;
    const score =
      totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0;
    const xpAwarded = Math.max(0, Math.round(score));

    const attemptRef = db.collection("attempts").doc();
    await db.runTransaction(async (tx) => {
      const profileRef = db.doc(`profiles/${uid}`);
      const profileSnap = await tx.get(profileRef);
      const currentXp = profileSnap.exists
        ? ((profileSnap.data()?.xp as number) ?? 0)
        : 0;
      const currentCases = profileSnap.exists
        ? ((profileSnap.data()?.casesClosed as number) ?? 0)
        : 0;

      tx.set(attemptRef, {
        scenarioId,
        scenarioTitle: scenario.title,
        userId: uid,
        submittedAt: FieldValue.serverTimestamp(),
        score,
        correctCount,
        totalCount,
        xpAwarded,
        results,
        questionResults,
      });

      tx.set(
        profileRef,
        {
          xp: currentXp + xpAwarded,
          casesClosed: currentCases + (score >= 70 ? 1 : 0),
        },
        { merge: true },
      );
    });

    return {
      attemptId: attemptRef.id,
      score,
      correctCount,
      totalCount,
      xpAwarded,
      results,
      questionResults,
    };
  });
