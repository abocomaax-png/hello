import type { Timestamp } from "firebase/firestore";

// Firestore stores `serverTimestamp()` writes as Timestamp objects, not raw
// numbers. Every "millis" field below is a Timestamp at rest in the
// database — read it through this helper before formatting/displaying it.
export function toMillis(value: Timestamp | number | null | undefined): number {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  return value.toMillis();
}

export type Profile = {
  handle: string;
  displayName: string | null;
  xp: number;
  badge: string;
  casesClosed: number;
  createdAt: Timestamp | number;
};

export type Scenario = {
  slug: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  sourceLabel: string;
  isPublished: boolean;
  createdBy: string;
  createdAt: Timestamp | number;
};

// `isPublished` is denormalized onto every log/question doc at publish time
// so security rules can check `resource.data.isPublished` directly instead
// of doing a `get()` on the parent scenario for every single document a
// query returns (that pattern multiplies reads/latency by N documents).
export type ScenarioLog = {
  seq: number;
  eventTime: string | null;
  eventId: string | null;
  source: string | null;
  message: string;
  raw: Record<string, unknown> | null;
  isPublished: boolean;
};

// Never read directly by trainee clients — only written by the admin author
// and read by the grading Cloud Function (Admin SDK bypasses Firestore rules).
export type ScenarioLogAnswer = {
  isMalicious: boolean;
  mitre: string | null;
  explanation: string;
};

export type ScenarioQuestion = {
  seq: number;
  text: string;
  hint: string | null;
  isPublished: boolean;
};

// Never read directly by trainee clients — same protection as ScenarioLogAnswer.
export type ScenarioQuestionAnswer = {
  answer: string;
};

export type AttemptResultLine = {
  logId: string;
  markedMalicious: boolean;
  isMalicious: boolean;
  correct: boolean;
  mitre: string | null;
  explanation: string;
};

export type QuestionResultLine = {
  questionId: string;
  question: string;
  submittedAnswer: string;
  correctAnswer: string;
  correct: boolean;
};

export type Attempt = {
  scenarioId: string;
  scenarioTitle: string;
  userId: string;
  submittedAt: Timestamp | number;
  score: number;
  correctCount: number;
  totalCount: number;
  xpAwarded: number;
  results: AttemptResultLine[];
  questionResults: QuestionResultLine[];
};

export type SubmitScenarioAttemptRequest = {
  scenarioId: string;
  answers: Array<{ logId: string; markedMalicious: boolean }>;
  questionAnswers: Array<{ questionId: string; answerText: string }>;
};

export type SubmitScenarioAttemptResponse = {
  attemptId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  xpAwarded: number;
  results: AttemptResultLine[];
  questionResults: QuestionResultLine[];
};
