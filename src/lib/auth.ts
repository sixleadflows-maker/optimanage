import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";

// A signed-in account is checked against the database again, so the owner
// editing someone's role or deactivating them applies on their next request
// rather than whenever they next sign in. Cached briefly per server instance
// so every page and action doesn't pay for the lookup.
const ACCOUNT_RECHECK_MS = 30_000;
type Account = { name: string; email: string; role: string; branchId: string | null };
const checkedAccounts = new Map<string, { at: number; account: Account | null }>();

/** The account as it is now; null once deactivated or gone; undefined if it couldn't be checked. */
async function currentAccount(id: string): Promise<Account | null | undefined> {
  const hit = checkedAccounts.get(id);
  if (hit && Date.now() - hit.at < ACCOUNT_RECHECK_MS) return hit.account;
  try {
    const u = await db.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, branchId: true, active: true },
    });
    const account = u?.active ? { name: u.name, email: u.email, role: u.role, branchId: u.branchId } : null;
    checkedAccounts.set(id, { at: Date.now(), account });
    return account;
  } catch {
    // A failed lookup must not sign anyone out (a thrown error here would).
    return undefined;
  }
}

/** Re-check this account on its next request -- called right after it's edited. */
export function forgetAccount(id: string) {
  checkedAccounts.delete(id);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const valid = await compare(credentials.password as string, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatar,
          branchId: user.branchId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.branchId = (user as any).branchId;
        return token;
      }
      if (typeof token.id !== "string") return token;
      const account = await currentAccount(token.id);
      // Deactivated (or removed) since signing in: signed out.
      if (account === null) return null;
      if (account) {
        token.name = account.name;
        token.email = account.email;
        token.role = account.role;
        token.branchId = account.branchId ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.branchId = token.branchId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
