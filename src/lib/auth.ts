import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const authOptions: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
        remember: { label: '记住我', type: 'checkbox' },
      },
      async authorize(credentials, req) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          return null;
        }

        // 速率限制检查
        const clientIp = getClientIp(req);
        const rateLimitResult = await checkRateLimit(`login:${clientIp}`, {
          windowMs: 60 * 60 * 1000,
          max: 10,
        });

        if (!rateLimitResult.success) {
          return null;
        }

        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(
            password,
            user.passwordHash || ''
          );

          if (!isValid) {
            return null;
          }

          if (user.status === 'suspended') {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email,
            remember: credentials.remember === 'true',
          };
        } catch (error) {
          console.error('Login authorization error:', error);
          return null;
        }
      },
    }),
    
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email!))
            .limit(1);
          
          if (!existingUser) {
            // 首次 OAuth 登录：创建新用户
            const [newUser] = await db.insert(users).values({
              email: user.email!,
              name: user.name || user.email!.split('@')[0],
              avatarUrl: user.image,
              authProvider: account.provider.toUpperCase() as 'GOOGLE' | 'GITHUB',
              passwordHash: null,
            }).returning();
            
            // 重要：将数据库ID写入user对象，这样JWT callback可以获取到
            user.id = newUser.id;
          } else {
            // 账户关联策略：允许相同邮箱使用不同登录方式
            // QA-FEATURE-001: 当前实现允许自动关联，OAuth 用户可登录已存在的邮箱账户
            // 未来优化：在 Dashboard 显示所有关联的登录方式，允许手动解绑
            // 安全考虑：仅更新头像，不修改核心用户信息
            if (user.image && user.image !== existingUser.avatarUrl) {
              await db
                .update(users)
                .set({ 
                  avatarUrl: user.image,
                  updatedAt: new Date()
                })
                .where(eq(users.id, existingUser.id));
            }
            
            // 重要：使用数据库ID，而不是OAuth provider的ID
            user.id = existingUser.id;
          }
          
          return true;
        } catch (error) {
          console.error('OAuth signIn error:', error);
          return false;
        }
      }
      
      return true;
    },

    async jwt({ token, user, trigger, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.remember = user.remember;
      }
      
      // 对于OAuth登录，确保从数据库获取正确的user ID
      if (account?.provider === 'google' || account?.provider === 'github') {
        if (token.email) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, token.email as string))
            .limit(1);
          
          if (dbUser) {
            token.id = dbUser.id;
          }
        }
      }
      
      if (trigger === 'signIn' && token.remember) {
        token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      } else if (trigger === 'signIn') {
        token.exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

