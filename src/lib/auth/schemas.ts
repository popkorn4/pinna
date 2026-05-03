import { z } from "zod";

// почему такие требования к паролю: минимум 8, цифра + заглавная — баланс между
// удобством и устойчивостью к словарным атакам. bcrypt берёт на себя остальное.
const passwordRules = z
  .string()
  .min(8, "Минимум 8 символов")
  .regex(/[0-9]/, "Хотя бы одна цифра")
  .regex(/[A-ZА-ЯЁ]/, "Хотя бы одна заглавная буква");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Минимум 2 символа").max(80),
    email: z.string().trim().toLowerCase().email("Неверный email"),
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Неверный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
