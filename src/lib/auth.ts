import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { SessionUser, BaseSessionUser } from "@/types";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  interface User extends SessionUser {}
}

declare module "@auth/core/jwt" {
  interface JWT extends SessionUser {}
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          roleName: user.role.name,
          permissions: user.role.permissions.map((rp) => rp.permission.name),
          office: user.office || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateSession }) {
      if (user) {
        token.id = user.id!;
        token.email = user.email!;
        token.firstName = (user as SessionUser).firstName;
        token.lastName = (user as SessionUser).lastName;
        token.roleId = (user as SessionUser).roleId;
        token.roleName = (user as SessionUser).roleName;
        token.permissions = (user as SessionUser).permissions;
        token.office = (user as SessionUser).office;
      }

      // Handle session updates (for impersonation)
      if (trigger === "update" && updateSession) {
        // Start impersonation
        if (updateSession.impersonatingAs) {
          // Store original user if not already impersonating
          if (!token.originalUser) {
            token.originalUser = {
              id: token.id as string,
              email: token.email as string,
              firstName: token.firstName as string,
              lastName: token.lastName as string,
              roleId: token.roleId as string,
              roleName: token.roleName as string,
              permissions: token.permissions as string[],
              office: token.office as string | undefined,
            };
          }

          // Apply impersonated user's data
          const impersonated = updateSession.impersonatingAs as BaseSessionUser;
          token.id = impersonated.id;
          token.email = impersonated.email;
          token.firstName = impersonated.firstName;
          token.lastName = impersonated.lastName;
          token.roleId = impersonated.roleId;
          token.roleName = impersonated.roleName;
          token.permissions = impersonated.permissions;
          token.office = impersonated.office;
          token.impersonatingAs = impersonated;
        }

        // Stop impersonation
        if (updateSession.stopImpersonation && token.originalUser) {
          const original = token.originalUser as BaseSessionUser;
          token.id = original.id;
          token.email = original.email;
          token.firstName = original.firstName;
          token.lastName = original.lastName;
          token.roleId = original.roleId;
          token.roleName = original.roleName;
          token.permissions = original.permissions;
          token.office = original.office;
          token.originalUser = undefined;
          token.impersonatingAs = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        email: token.email as string,
        firstName: token.firstName as string,
        lastName: token.lastName as string,
        roleId: token.roleId as string,
        roleName: token.roleName as string,
        permissions: token.permissions as string[],
        office: token.office as string | undefined,
        originalUser: token.originalUser as BaseSessionUser | undefined,
        impersonatingAs: token.impersonatingAs as BaseSessionUser | undefined,
      } as SessionUser & { emailVerified: Date | null };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

// Helper function to check permissions
function hasPermission(
  permissions: string[],
  required: string | string[]
): boolean {
  const requiredPerms = Array.isArray(required) ? required : [required];
  return requiredPerms.some((perm) => permissions.includes(perm));
}

// Helper to check if user is admin
export function isAdmin(roleName: string): boolean {
  return roleName === "Admin";
}

// Helper to get current session on server
async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

// Helper to require auth
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

// Helper to require specific permission
export async function requirePermission(
  required: string | string[]
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!isAdmin(user.roleName) && !hasPermission(user.permissions, required)) {
    throw new Error("Forbidden");
  }
  return user;
}
