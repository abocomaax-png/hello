import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-grid px-4">
      <div className="max-w-md text-center panel p-10">
        <p className="chip chip-cyber mx-auto w-fit">404 · Signal Lost</p>
        <h1 className="mt-6 text-6xl font-bold text-foreground">Route not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The path you requested is not indexed in the ti3lab telemetry.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return to base
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center panel p-8">
        <p className="chip chip-danger mx-auto w-fit">System Fault</p>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          Runtime error captured
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reinitialize the module or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reinitialize
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-sm border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ti3lab — Cyber Defense Operations Platform" },
      {
        name: "description",
        content:
          "ti3lab is a defensive cybersecurity training and operations platform for SOC analysts, DFIR investigators, and blue-team defenders.",
      },
      { name: "theme-color", content: "#000000" },
      { property: "og:title", content: "ti3lab — Cyber Defense Operations Platform" },
      {
        property: "og:description",
        content:
          "SOC playbooks, DFIR log analytics, live incident simulation and analyst leaderboard — engineered for blue-team defenders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
