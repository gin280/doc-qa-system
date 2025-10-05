# 文档向量化测试指南

## 测试目标

验证Story 2.4的完整功能：
1. ✅ 文档分块 (Chunking)
2. ✅ 向量化 (Embedding)
3. ✅ 自动触发流程
4. ✅ 状态管理
5. ✅ 错误处理

---

## 前置准备

### 1. 环境配置

确保 `.env.local` 已配置：

```bash
# 必需配置
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# LLM配置（智谱AI）
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your-key
```

### 2. 准备测试文件

在 `tests/fixtures/` 中已有测试文件：

- `pdf/sample.pdf` - 小型PDF (10KB)
- `docx/sample.docx` - Word文档
- `text/sample.txt` - 纯文本

### 3. 启动服务

```bash
npm run dev
```

访问: http://localhost:3000

---

## 🧪 测试用例

### 测试1: 基础流程 - 小文档向量化

**目标**: 验证完整的自动化流程

**步骤**:

1. **登录系统**
   - 访问 http://localhost:3000
   - 注册/登录账号

2. **上传文档**
   - 点击"上传文档"
   - 选择 `tests/fixtures/pdf/sample.pdf`
   - 确认上传成功
   - **预期**: 状态显示 `PENDING`

3. **触发解析** (通常自动触发)
   - 点击"解析"按钮
   - **预期**: 状态变为 `PARSING`
   - 等待3-5秒
   - **预期**: 状态变为 `READY`

4. **自动向量化** (后台自动)
   - 无需手动操作
   - 刷新页面查看状态
   - **预期**: 状态显示 `EMBEDDING`
   - 等待10-30秒（取决于文档大小）
   - **预期**: 状态变为 `READY`
   - **预期**: chunksCount > 0

5. **验证结果**
   
   打开浏览器控制台 (F12)，查看Network标签：
   
   ```bash
   GET /api/documents/[id]/process
   
   响应:
   {
     "id": "xxx",
     "status": "READY",
     "chunksCount": 15,  // 实际数量
     "metadata": {
       "embedding": {
         "vectorCount": 15,
         "dimension": 1536,
         "provider": "zhipu"
       }
     }
   }
   ```

6. **查看chunks**
   
   ```bash
   GET /api/documents/[id]/chunks
   
   响应:
   {
     "chunks": [...],
     "pagination": {
       "total": 15,
       "hasMore": false
     }
   }
   ```

**预期结果**:
- ✅ 文档状态: PENDING → PARSING → READY → EMBEDDING → READY
- ✅ chunksCount: > 0
- ✅ 向量维度: 1536
- ✅ 提供商: zhipu

---

### 测试2: 大文档处理

**目标**: 验证批量处理和性能

**步骤**:

1. 上传较大的PDF (50-100KB)
2. 观察处理时间
3. 检查是否有批处理日志

**在服务器日志中查找**:

```
[Chunking] Document xxx: 开始分块, 文本长度=45678字符
[Chunking] 分块完成: 45个chunks
[Embedding] Document xxx: 开始向量化, chunks数=45
[Embedding] 处理批次 1/3: chunks 0-20
[Embedding] 批次 1 完成
[Embedding] 处理批次 2/3: chunks 20-40
[Embedding] 批次 2 完成
[Embedding] 处理批次 3/3: chunks 40-45
[Embedding] 批次 3 完成
[Embedding] Document xxx: 向量化完成
```

**预期结果**:
- ✅ 大文档正确分块（每块约1000字符）
- ✅ 批量处理（20 chunks/batch）
- ✅ 处理时间 < 60秒

---

### 测试3: 错误处理

**目标**: 验证错误处理机制

#### 3.1 无效的API Key

**步骤**:
1. 临时修改 `.env.local`，设置错误的API Key
2. 重启服务
3. 上传文档
4. 观察错误处理

**预期结果**:
- ✅ 状态变为 `FAILED`
- ✅ metadata.error 包含错误信息
- ✅ 前端显示友好的错误提示

#### 3.2 超大文档

**步骤**:
1. 尝试上传 > 10MB 的文档
2. 观察处理结果

**预期结果**:
- ✅ 上传阶段即被拦截（文件大小限制）
- ✅ 或解析阶段超时处理

---

### 测试4: API端点测试

使用curl或Postman测试API：

#### 4.1 触发处理

```bash
curl -X POST http://localhost:3000/api/documents/[id]/process \
  -H "Cookie: your-session-cookie"
```

**预期**: 返回处理结果

#### 4.2 查询状态

```bash
curl http://localhost:3000/api/documents/[id]/process \
  -H "Cookie: your-session-cookie"
```

**预期**: 返回当前状态和chunks数量

#### 4.3 查询chunks

```bash
curl http://localhost:3000/api/documents/[id]/chunks?limit=5 \
  -H "Cookie: your-session-cookie"
```

**预期**: 返回分页的chunks列表

---

### 测试5: 多文档并发

**目标**: 验证并发处理能力

**步骤**:
1. 连续上传3-5个文档
2. 触发所有文档的解析
3. 观察并发处理情况

**预期结果**:
- ✅ 所有文档都能正确处理
- ✅ 不会互相干扰
- ✅ 状态独立管理

---

## 🔍 调试技巧

### 1. 查看服务器日志

开发环境中，服务器日志会实时显示处理进度：

```bash
npm run dev

# 查看日志输出
[ParseService] Successfully parsed document xxx
[Chunking] Document xxx: 开始分块...
[Embedding] Document xxx: 开始向量化...
```

### 2. 使用浏览器DevTools

- **Network标签**: 查看API请求响应
- **Console标签**: 查看前端日志
- **Application → Storage**: 查看session状态

### 3. 数据库检查

使用Drizzle Studio查看数据：

```bash
npm run db:studio
```

检查：
- `documents` 表的 status 和 metadata
- `document_chunks` 表的 chunks 和 embedding
- embedding 向量是否正确存储

### 4. 性能监控

在代码中添加时间戳：

```typescript
console.time('分块处理')
// ... 分块代码
console.timeEnd('分块处理')

console.time('向量化')
// ... 向量化代码
console.timeEnd('向量化')
```

---

## ✅ 测试检查清单

完成以下所有测试项：

### 基础功能
- [ ] 小文档 (10KB) 完整流程
- [ ] 中文档 (50KB) 完整流程
- [ ] PDF文档处理
- [ ] Word文档处理
- [ ] 纯文本处理

### 状态管理
- [ ] PENDING → PARSING 转换
- [ ] PARSING → READY 转换
- [ ] READY → EMBEDDING 转换
- [ ] EMBEDDING → READY 转换
- [ ] 错误时 → FAILED 转换

### 数据验证
- [ ] chunksCount 正确
- [ ] embedding 维度 = 1536
- [ ] 提供商 = zhipu
- [ ] chunks 内容正确
- [ ] metadata 完整

### 错误处理
- [ ] 无效API Key
- [ ] 网络超时
- [ ] 文档过大
- [ ] 并发处理

### 性能指标
- [ ] 10KB文档 < 10秒
- [ ] 50KB文档 < 30秒
- [ ] 100KB文档 < 60秒
- [ ] 批量处理生效

---

## 🐛 常见问题

### Q: 状态一直是EMBEDDING？

**可能原因**:
- API Key无效
- 网络问题
- 服务器错误

**解决方法**:
1. 检查服务器日志
2. 验证API Key
3. 查看数据库 metadata.error

### Q: chunks为空？

**可能原因**:
- 文档解析失败
- 分块服务错误

**解决方法**:
1. 检查文档是否正确解析
2. 查看 metadata.content 是否存在
3. 检查分块服务日志

### Q: 向量化很慢？

**可能原因**:
- 文档太大
- 网络延迟
- API限流

**解决方法**:
1. 减小文档大小
2. 检查网络连接
3. 增加超时时间

---

## 📊 性能基准

参考性能指标：

| 文档大小 | Chunks数 | 分块时间 | 向量化时间 | 总时间 |
|---------|---------|---------|-----------|--------|
| 10KB    | ~10     | <1s     | ~5s       | <10s   |
| 50KB    | ~50     | <2s     | ~15s      | <20s   |
| 100KB   | ~100    | <5s     | ~30s      | <40s   |

---

**测试完成后，请在GitHub Issue中报告结果！** 🎉
