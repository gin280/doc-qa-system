import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const authOptions: NextAuthConfig = {
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
          throw new Error('邮箱和密码不能为空');
        }

        // 速率限制检查
        const clientIp = getClientIp(req);
        const rateLimitResult = await checkRateLimit(`login:${clientIp}`, {
          windowMs: 60 * 60 * 1000, // 1小时
          max: 10, // 最多10次尝试
        });

        if (!rateLimitResult.success) {
          throw new Error('登录尝试过于频繁，请稍后再试');
        }

        try {
          // 查询用户
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user) {
            throw new Error('邮箱或密码错误');
          }

          // 验证密码
          const isValid = await bcrypt.compare(
            password,
            user.passwordHash || ''
          );

          if (!isValid) {
            throw new Error('邮箱或密码错误');
          }

          // 检查用户是否被禁用
          if (user.status === 'suspended') {
            throw new Error('您的账户已被暂停，请联系管理员');
          }

          // 返回用户信息（包含 remember 标记）
          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email,
            remember: credentials.remember === 'true',
          };
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('登录失败，请稍后重试');
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7天(默认)
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.remember = user.remember;
      }
      
      // 动态设置 token 过期时间
      if (trigger === 'signIn' && token.remember) {
        // 记住我：30天
        token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      } else if (trigger === 'signIn') {
        // 默认：7天
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
export const { GET, POST } = handlers;

