# UI System Integration Guide

**适用于**: Epic 2、Epic 3 及后续所有开发
**基于**: Story 1.8 - 全局 UI/UX 增强优化
**最后更新**: 2025-01-03

---

## 📋 必读：Story 1.8 UI 系统规范

所有新开发的组件和页面**必须遵循** Story 1.8 建立的 OKLCH 主题系统和设计规范。

---

## 🎨 颜色使用规范

### ✅ 正确做法：使用语义化类名

```tsx
// ✅ 主要文字
<h1 className="text-foreground">标题</h1>
<p className="text-muted-foreground">次要说明</p>

// ✅ 按钮
<Button className="bg-primary text-primary-foreground">主按钮</Button>
<Button className="bg-secondary text-secondary-foreground">次要按钮</Button>
<Button className="bg-destructive text-destructive-foreground">删除</Button>

// ✅ 卡片
<Card className="bg-card text-card-foreground border-border">
  <CardHeader>
    <h3 className="text-foreground">卡片标题</h3>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">卡片内容</p>
  </CardContent>
</Card>

// ✅ 链接
<Link href="/docs" className="text-primary hover:underline">
  查看文档
</Link>

// ✅ 错误提示
<Alert className="bg-destructive/10 border-destructive/30 text-destructive">
  <AlertTitle>错误</AlertTitle>
  <AlertDescription>操作失败，请重试</AlertDescription>
</Alert>

// ✅ 成功提示（特殊颜色需要暗色模式适配）
<div className="bg-green-50 dark:bg-green-950/20 
                border-green-200 dark:border-green-800
                text-green-800 dark:text-green-200">
  操作成功！
</div>
```

### ❌ 错误做法：硬编码颜色

```tsx
// ❌ 禁止使用 Hex 颜色的 Tailwind 类
<div className="bg-blue-500 text-white">主按钮</div>
<p className="text-gray-600">次要文字</p>
<div className="bg-red-50 border-red-200">错误提示</div>
<Button className="bg-purple-600">次要按钮</Button>

// ❌ 禁止在 CSS 中硬编码颜色
<div style={{ backgroundColor: '#2563EB' }}>不要这样做</div>
```

---

## 📋 颜色映射速查表

从旧的 Tailwind 类名迁移到新的语义化类名：

| 使用场景 | ❌ 旧类名 | ✅ 新类名 |
|---------|----------|----------|
| 主要文字 | `text-gray-900` | `text-foreground` |
| 次要文字 | `text-gray-600` | `text-muted-foreground` |
| 占位文字 | `text-gray-400` | `text-muted-foreground/50` |
| 主色按钮 | `bg-blue-600` | `bg-primary text-primary-foreground` |
| 次要按钮 | `bg-gray-100` | `bg-secondary text-secondary-foreground` |
| 危险按钮 | `bg-red-500` | `bg-destructive text-destructive-foreground` |
| 链接文字 | `text-blue-600` | `text-primary` |
| 错误提示 | `text-red-600` | `text-destructive` |
| 卡片背景 | `bg-white` | `bg-card` |
| 页面背景 | `bg-gray-50` | `bg-background` |
| 边框颜色 | `border-gray-200` | `border-border` |
| 悬停背景 | `bg-gray-100` | `bg-accent` |
| 浅色背景 | `bg-gray-50` | `bg-muted` |

---

## 🔧 可复用组件（来自 Story 1.8）

以下组件已由 Story 1.8 实现，可直接使用：

### Toast 通知系统
```tsx
import { toast } from '@/lib/toast-utils';

// 成功提示
toast.success('文档上传成功！');

// 错误提示（带行动按钮）
toast.error('上传失败', {
  label: '重试',
  onClick: () => handleRetry()
});

// 警告提示
toast.warning('存储空间即将用完');

// 信息提示
toast.info('正在处理您的请求...');
```

### Skeleton 加载状态
```tsx
import { Skeleton } from '@/components/ui/skeleton';

// 卡片骨架
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-[125px] w-full" />
  </CardContent>
</Card>

// 列表骨架
{[1, 2, 3].map((i) => (
  <div key={i} className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-[80%]" />
  </div>
))}
```

### EmptyState 空状态
```tsx
import { EmptyState } from '@/components/shared/EmptyState';
import { FileQuestion } from 'lucide-react';

<EmptyState
  icon={FileQuestion}
  title="还没有文档"
  description="上传您的第一份文档，开始智能问答"
  action={{
    label: '上传文档',
    onClick: () => handleUpload()
  }}
  secondaryAction={{
    label: '查看示例',
    onClick: () => showExample()
  }}
/>
```

### PasswordStrength 密码强度指示器
```tsx
import { PasswordStrength } from '@/components/auth/PasswordStrength';

<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
<PasswordStrength password={password} />
```

### ThemeToggle 主题切换器
```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

// 在 Header 中使用
<Header>
  <Logo />
  <Navigation />
  <ThemeToggle />  {/* 主题切换器 */}
  <UserMenu />
</Header>
```

---

## 🌗 暗色模式测试清单

每个 Story 完成后，**必须**在两种主题下测试：

### 功能测试
- [ ] 在亮色模式下测试所有功能正常
- [ ] 切换到暗色模式，再次测试所有功能
- [ ] 主题切换平滑无闪烁（200ms 过渡）

### 视觉测试
- [ ] 所有文字可读（对比度 ≥ 4.5:1）
- [ ] 按钮、卡片、边框在两种模式下都清晰可见
- [ ] 图标颜色正确（应跟随文字颜色）
- [ ] 背景和前景色对比合理

### 边缘情况
- [ ] 悬停状态在暗色模式下正常
- [ ] 焦点指示器在两种模式下都清晰
- [ ] Loading 状态动画在暗色模式下可见
- [ ] Toast 通知在两种模式下都易读

---

## 🚀 性能要求

遵循 Story 1.8 的性能约束：

### 动画性能
- ✅ 仅动画 `transform` 和 `opacity`（GPU 加速）
- ❌ 禁止动画 `width`、`height`、`top`、`left`（触发 reflow）
- ✅ 动画帧率 ≥ 60fps
- ✅ 支持 `prefers-reduced-motion`

```tsx
// ✅ 正确：使用 transform
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  {content}
</motion.div>

// ❌ 错误：动画 height
<motion.div
  initial={{ height: 0 }}
  animate={{ height: 'auto' }}
>
  {content}
</motion.div>
```

### 打包体积
- 每个新功能增加的打包体积 < 50KB (gzipped)
- 使用 Tree Shaking 按需导入
- 大型库使用懒加载

---

## ✅ Story DoD (Definition of Done) 检查清单

在标记 Story 为 "Ready for Review" 前，确保：

### UI 系统合规性
- [ ] 所有颜色使用语义化类名（无硬编码）
- [ ] 运行 `grep -r "bg-blue-" src/` 无结果
- [ ] 运行 `grep -r "text-gray-" src/` 无结果
- [ ] 在亮色和暗色模式下测试通过

### 性能达标
- [ ] Lighthouse Performance Score > 90
- [ ] 动画帧率 ≥ 60fps
- [ ] 打包体积增量 < 50KB

### 可访问性
- [ ] 颜色对比度符合 WCAG AA (4.5:1)
- [ ] 键盘导航完全支持
- [ ] 焦点指示器清晰可见
- [ ] 屏幕阅读器友好

---

## 📚 参考资源

- **Story 1.8 完整文档**: `docs/stories/1.8-ui-ux-enhancement.md`
- **Front-End Spec**: `docs/front-end-spec.md`
- **Color System**: `docs/front-end-spec.md#color-palette`
- **Component Library**: `docs/front-end-spec.md#core-components`
- **主题编辑器**: [tweakcn.com/editor/theme](https://tweakcn.com/editor/theme)

---

## ❓ 常见问题

**Q: 我需要一个不在语义化颜色表中的颜色怎么办？**

A: 首先检查是否可以用现有颜色 + 透明度实现（如 `bg-primary/10`）。如果确实需要新颜色，联系 UX Expert 或 PO 讨论是否添加到主题系统。

**Q: 某个第三方组件库的颜色无法控制怎么办？**

A: 使用 CSS Variables 覆盖：
```css
.third-party-component {
  --component-bg: hsl(var(--background));
  --component-text: hsl(var(--foreground));
}
```

**Q: 如何测试暗色模式？**

A: 
1. 点击 Header 的主题切换器
2. 或在浏览器 DevTools 中模拟：DevTools → Rendering → Emulate CSS media → `prefers-color-scheme: dark`

---

**最后更新**: 2025-01-03  
**维护者**: PO (Sarah)

