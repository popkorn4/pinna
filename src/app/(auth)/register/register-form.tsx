"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/auth/schemas";
import { registerAction, loginAction } from "@/server/auth-actions";

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    getValues,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await registerAction(values);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            setError(k as keyof RegisterInput, { message: v });
          }
        } else {
          toast.error(res.error);
        }
        return;
      }

      // автологин сразу после регистрации
      const { email, password } = getValues();
      const login = await loginAction({ email, password });
      if (!login.ok) {
        toast.error("Не удалось войти автоматически. Попробуйте через /login.");
        router.push("/login");
        return;
      }
      router.push(login.data.redirectTo);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Имя" error={errors.name?.message}>
        <Input autoComplete="name" autoFocus {...register("name")} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Пароль" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
      </Field>
      <Field label="Повторите пароль" error={errors.confirmPassword?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </Button>
      <p className="text-sm text-muted-foreground text-center">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Войти
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
