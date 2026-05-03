import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight">Регистрация</h1>
        <p className="text-muted-foreground mt-2">
          Заведём аккаунт за полминуты — и сразу в работу.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
