import { auth, signOut } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">欢迎回来!</h1>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <Button type="submit" variant="outline">
                退出登录
              </Button>
            </form>
          </div>
          <p className="text-gray-600 mb-2">
            您已成功登录
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded">
            <p className="text-sm text-gray-700">
              <strong>用户信息:</strong>
            </p>
            <p className="text-sm text-gray-600">邮箱: {session.user.email}</p>
            <p className="text-sm text-gray-600">姓名: {session.user.name}</p>
            <p className="text-sm text-gray-600">ID: {session.user.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

