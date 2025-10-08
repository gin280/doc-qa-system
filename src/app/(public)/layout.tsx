/**
 * Public Layout - 公开页面布局
 * 
 * 功能:
 * - 无认证保护
 * - 简单布局（无 AppHeader）
 * - 适用于: /, /login, /register
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}

