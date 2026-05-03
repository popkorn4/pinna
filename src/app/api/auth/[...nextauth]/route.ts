// Прокси на стандартные handlers Auth.js — нужен для Credentials,
// signIn/signOut и проверки сессии через /api/auth/*.
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
