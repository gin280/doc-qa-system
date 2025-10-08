import { LoginForm } from '@/components/auth/LoginForm';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '登录 - 智能文档问答系统',
  description: '登录您的账户访问智能文档问答功能',
};

interface LoginPageProps {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const oauthError = searchParams.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-6 space-y-4">
          {/* OAuth 错误提示 */}
          {oauthError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
              <p className="text-sm font-medium">登录失败</p>
              <p className="text-sm mt-1">
                {oauthError === 'OAuthCallback' && 'OAuth 登录失败，请稍后重试或使用邮箱登录'}
                {oauthError === 'OAuthAccountNotLinked' && '该邮箱已被其他登录方式使用'}
                {oauthError === 'AccessDenied' && '您已取消授权'}
                {!['OAuthCallback', 'OAuthAccountNotLinked', 'AccessDenied'].includes(oauthError) && 
                  '登录过程中出现错误，请重试'}
              </p>
            </div>
          )}
          
          <LoginForm />
          <OAuthButtons />
        </CardContent>
      </Card>
    </div>
  );
}

