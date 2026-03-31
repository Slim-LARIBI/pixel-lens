import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),

  providers: [
    CredentialsProvider({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@company.com" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email) return null;

        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            name: email.split("@")[0],
          },
        });

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],

  // ✅ IMPORTANT: CredentialsProvider requires JWT strategy in NextAuth v4
  session: { strategy: "jwt" },
  jwt: { secret: process.env.NEXTAUTH_SECRET },

  pages: {
    signIn: "/login",
    error: "/login/error",
  },

  callbacks: {
    async session({ session, token }) {
      if (session.user && token?.sub) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};