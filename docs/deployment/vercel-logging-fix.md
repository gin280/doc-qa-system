# Vercel 日志系统修复说明

## 问题描述

### 错误现象

在本地开发环境运行 `npm run dev` 时，大量出现以下错误：

```
Error: Cannot find module '.next/server/vendor-chunks/lib/worker.js'
Error: the worker has exited
Error: the worker thread exited
```

### 影响

- ❌ 控制台被错误信息淹没
- ❌ 日志输出失败（worker thread 崩溃）
- ✅ **核心功能正常**（仅影响日志）

## 问题根源

### Pino + Next.js 的 Worker Thread 冲突

1. **pino-pretty transport** 使用 `thread-stream` 库创建 worker threads 来处理日志格式化
2. **Next.js webpack** 在开发模式下无法正确解析 worker 文件的模块路径
3. **Worker 启动失败** 导致日志系统崩溃

### 技术细节

```typescript
// 问题配置 (旧版)
{
  transport: {
    target: 'pino-pretty',  // ❌ 启动 worker thread
    options: { colorize: true }
  }
}
```

Worker thread 尝试加载：
```
.next/server/vendor-chunks/lib/worker.js  // ❌ 路径不存在
```

## 解决方案

### 方案 1: 禁用 Transport（已实施）✅

**修改文件**: `src/lib/logger.ts`

```typescript
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // 不使用 transport，避免 worker thread 问题
  // 所有环境都输出标准 JSON 到 stdout/stderr
})
```

**优点**:
- ✅ 完全避免 worker thread 问题
- ✅ 生产环境和开发环境配置一致
- ✅ Vercel 部署零问题

**日志输出格式**:
```json
{"level":30,"time":1704729600000,"msg":"Document uploaded","action":"upload_success"}
```

### 方案 2: 使用 Pino-Pretty CLI（可选）

如果需要美化的日志输出，可以通过管道使用：

```bash
# 在 package.json 中添加
"dev:pretty": "npm run dev 2>&1 | npx pino-pretty"
```

运行：
```bash
npm run dev:pretty
```

输出效果：
```
[14:20:00.000] INFO: Document uploaded
    action: "upload_success"
    userId: "abc123"
```

### 方案 3: 使用其他日志工具（未采用）

可选方案：
- **Winston**: 不使用 worker threads
- **Bunyan**: 类似架构但更重
- **Console**: 最简单但功能少

**为什么不选**: Pino 性能最好，与 Vercel/Axiom 集成最佳

## 相关修复

### 1. PDF 解析修复（同时进行）

**问题**: `pdf-parse` 依赖 native 模块 `@napi-rs/canvas`，Vercel serverless 不支持

**解决**: 替换为纯 JS 实现的 `pdfjs-dist`

```bash
npm install pdfjs-dist@3.11.174
npm uninstall pdf-parse @types/pdf-parse
```

**文件修改**: `src/services/documents/parserService.ts`

## 验证修复

### 1. 清理并重启

```bash
# 清理构建缓存
rm -rf .next

# 重新安装依赖（如果修改了 package.json）
npm install

# 启动开发服务器
npm run dev
```

### 2. 检查日志输出

应该看到：
```json
{"level":30,"time":1704729600000,"msg":"Server started","port":3000}
```

不应该看到：
```
❌ Error: Cannot find module '.next/server/vendor-chunks/lib/worker.js'
❌ Error: the worker has exited
```

### 3. 测试核心功能

```bash
# 测试文档上传和解析
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@test.pdf" \
  -H "Authorization: Bearer $TOKEN"
```

## 生产环境部署

### Vercel 日志集成

修复后的配置在 Vercel 上完美工作：

1. **标准 JSON 输出** → Vercel Logs 自动收集
2. **Vercel Logs** → 自动转发到 Axiom（如已配置）
3. **查看日志**: Vercel Dashboard → Functions → Logs

### Axiom 集成（可选）

如需 Axiom 集成：

```bash
# Vercel Dashboard → Integrations → Axiom
# 自动转发所有日志到 Axiom
```

无需修改代码，Vercel 会自动处理。

## 最佳实践

### 开发环境

```bash
# 标准 JSON 输出（已修复）
npm run dev

# 美化输出（可选）
npm run dev 2>&1 | npx pino-pretty
```

### 生产环境

```bash
# Vercel 自动处理
# 日志 → Vercel Logs → Axiom（如已集成）
```

### 日志级别控制

```bash
# .env.local
LOG_LEVEL=debug  # 开发环境：详细日志
LOG_LEVEL=info   # 生产环境：标准日志
LOG_LEVEL=error  # 生产环境：仅错误
```

## 参考资料

- [Pino Transport 文档](https://github.com/pinojs/pino/blob/master/docs/transports.md)
- [Next.js + Pino 已知问题](https://github.com/pinojs/pino/issues/1408)
- [Vercel Logs 文档](https://vercel.com/docs/observability/runtime-logs)
- [PDF.js 文档](https://mozilla.github.io/pdf.js/)

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-01-22 | 1.0 | 修复 Pino worker thread 问题，替换 PDF 解析器 |

