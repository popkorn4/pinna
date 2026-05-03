import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schemas";

// почему JWT а не database: Auth.js v5 + Credentials provider официально работает
// только с JWT-стратегией. Таблицы Account/Session оставлены в схеме под будущий
// OAuth (Google добавим отдельной фазой) — там переключимся либо на ручное
// создание сессий, либо оставим JWT и удалим Session/Account.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        // почему повторно валидируем здесь: authorize вызывается напрямую API
        // Auth.js, минуя нашу серверную форму — нельзя доверять входу
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // почему не различаем "нет юзера" и "плохой пароль": защита от email
        // enumeration. И bcrypt всё равно вызываем у фейкового хеша, чтобы
        // время ответа не отличалось (защита от тайминговой атаки).
        if (!user?.passwordHash) {
          await verifyPassword(parsed.data.password, "$2b$12$invalidhashplaceholder000000000000000000000000000000000");
          return null;
        }

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    // почему: пробрасываем id в jwt и далее в session, чтобы клиент знал id
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
