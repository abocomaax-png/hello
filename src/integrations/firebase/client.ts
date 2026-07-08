import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Every value here is a public, client-safe Firebase Web config identifier
// (not a secret) — see https://firebase.google.com/docs/projects/api-keys.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

function assertConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([key, value]) => key !== "measurementId" && !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    const message = `Missing Firebase environment variable(s): ${missing
      .map(
        (k) =>
          `VITE_FIREBASE_${k.replace(/[A-Z]/g, (l) => "_" + l).toUpperCase()}`,
      )
      .join(", ")}. Set them in your hosting provider's environment settings.`;
    console.error(`[Firebase] ${message}`);
    throw new Error(message);
  }
}

assertConfig();

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Grading (`submitScenarioAttempt`) now runs as a TanStack Start server
// function deployed to Vercel — see src/server/submit-scenario-attempt.ts —
// instead of a Firebase Cloud Function, so no `functions` client is needed
// here and the project no longer requires the Blaze plan.
