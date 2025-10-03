# 文档智能问答系统 (Doc Q&A System)

一个基于 Next.js 14 的智能文档问答系统，支持文档上传、管理和智能问答功能。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI组件**: shadcn/ui
- **部署**: Vercel

## 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
npm start
```

### 代码检查

```bash
npm run lint
```

## 项目结构

```
src/
├── app/                # Next.js App Router 页面
├── components/         # React 组件
│   ├── ui/            # shadcn/ui 基础组件
│   ├── auth/          # 认证相关组件
│   ├── documents/     # 文档管理组件
│   └── chat/          # 聊天问答组件
├── lib/               # 工具函数库
├── hooks/             # 自定义 React Hooks
├── services/          # API 服务层
├── types/             # TypeScript 类型定义
└── store/             # 状态管理
```

## 环境变量

复制 `.env.local.example` 为 `.env.local` 并填写相应配置：

```bash
cp .env.local.example .env.local
```

## 部署

### Vercel 部署

1. 推送代码到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 部署

### 手动部署

```bash
npm run build
```

将 `.next` 目录部署到你的服务器。

## 开发指南

- 遵循 ESLint 和 Prettier 配置
- 使用 TypeScript 严格模式
- 组件采用函数式编程
- 使用 Tailwind CSS 进行样式开发

## License

MIT

