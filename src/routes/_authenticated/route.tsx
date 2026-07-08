import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { AppSidebar, MobileTopBar } from "@/components/AppSidebar";

// Firebase Auth restores its session asynchronously, so we wait for the
// first onAuthStateChanged callback rather than relying on a synchronous
// "current user" read.
function waitForFirebaseUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user: initialUser } = Route.useRouteContext();
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar user={user} />
      <MobileTopBar user={user} />
      <main className="lg:pl-64">
        <Outlet />
      </main>
    </div>
  );
}
