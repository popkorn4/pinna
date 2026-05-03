import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight">Вход</h1>
        <p className="text-muted-foreground mt-2">
          Войдите, чтобы открыть свои доски.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
