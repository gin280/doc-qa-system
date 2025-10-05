# 快速开始指南

## 🚀 5分钟快速测试

### 步骤1：数据库配置（必需）

**⚠️ 在运行项目前必须先配置数据库！**

1. **打开 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目
   - 点击左侧菜单 "SQL Editor"

2. **执行配置SQL**
   ```sql
   -- 复制 scripts/enable-pgvector.sql 的全部内容
   -- 粘贴到 SQL Editor
   -- 点击 "Run"
   ```

3. **验证成功**
   - 看到 "Success" 提示
   - 查询结果显示 embedding 列存在（1024维）

---

### 步骤2：环境变量配置

创建 `.env.local` 文件：

```bash
# 智谱AI API Key（必需）
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=你的智谱AI-API-Key

# 数据库（必需）
DATABASE_URL=你的Supabase数据库URL

# NextAuth（必需）
NEXTAUTH_SECRET=随机生成的32字符密钥
NEXTAUTH_URL=http://localhost:3000

# Supabase存储（必需）
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色密钥

# 向量存储
VECTOR_PROVIDER=pgvector
```

**获取智谱AI API Key：**
- 注册：https://open.bigmodel.cn/
- API Keys：https://open.bigmodel.cn/usercenter/apikeys

**生成 NEXTAUTH_SECRET：**
```bash
openssl rand -base64 32
# 或访问: https://generate-secret.vercel.app/32
```

---

### 步骤3：安装依赖并启动

```bash
npm install
npm run dev
```

访问：http://localhost:3000

---

### 步骤4：测试向量化

1. **登录系统**
   - 注册新账号或登录

2. **上传文档**
   - 点击"上传文档"
   - 选择任意PDF/Word文档（建议10-50KB）
   - 确认上传成功

3. **观察处理流程**

   打开浏览器控制台（F12），观察服务器日志：

   ```
   ✅ 解析开始
   [ParseService] Successfully parsed document xxx
   
   ✅ 分块开始
   [Chunking] Document xxx: 开始分块, 文本长度=2954字符
   [Chunking] 分块完成: 4个chunks
   
   ✅ 向量化开始
   [Embedding] Document xxx: 开始向量化, chunks数=4
   [Embedding] 处理批次 1/1: chunks 0-4
   [Embedding] 批次 1 完成 ✅
   [Embedding] Document xxx: 向量化完成 ✅
   ```

4. **验证成功**

   在文档列表中，状态应显示：
   - ✅ Status: `READY`
   - ✅ chunksCount: > 0
   - ✅ 可以进行问答查询

---

## 🔍 常见问题排查

### Q1: `type "vector" does not exist`

**原因**：数据库未启用 pgvector 扩展

**解决**：
1. 检查是否执行了 `scripts/enable-pgvector.sql`
2. 在 Supabase SQL Editor 重新执行
3. 验证 pgvector 扩展已启用

### Q2: `expected 1536 dimensions, not 1024`

**原因**：数据库配置的是 OpenAI 的 1536 维，但使用的是智谱AI 的 1024 维

**解决**：
1. 执行更新后的 `scripts/enable-pgvector.sql`
2. 确保 SQL 中使用 `vector(1024)` 而非 `vector(1536)`
3. 重新上传测试文档

### Q3: `智谱AI API Key 无效`

**原因**：API Key 配置错误或未激活

**解决**：
1. 检查 `.env.local` 中的 `ZHIPU_API_KEY`
2. 确认 API Key 已在控制台创建
3. 确认账户有余额或免费额度

### Q4: 文档一直显示 `EMBEDDING` 状态

**原因**：向量化过程可能卡住

**解决**：
1. 检查服务器日志是否有错误
2. 刷新页面查看最新状态
3. 检查网络连接
4. 查看数据库 `documents` 表的 `metadata.error` 字段

---

## 📊 性能参考

| 文档大小 | 分块时间 | 向量化时间 | 总处理时间 |
|---------|---------|-----------|-----------|
| 10KB    | <1s     | ~5s       | <10s      |
| 50KB    | <2s     | ~15s      | <20s      |
| 100KB   | <5s     | ~30s      | <40s      |

---

## 🎉 测试成功！

如果你看到：
- ✅ 文档状态: `READY`
- ✅ chunksCount > 0
- ✅ 服务器日志显示 "向量化完成"

**恭喜！系统已成功运行！**

下一步：
- 测试问答功能（Story 2.5）
- 优化向量检索效果
- 部署到生产环境

---

## 📚 更多文档

- **智谱AI详细配置**: `docs/ZHIPU_AI_SETUP.md`
- **环境变量说明**: `docs/ENV_SETUP.md`
- **完整测试指南**: `docs/TESTING_GUIDE.md`
- **Story 2.4详情**: `docs/stories/2.4-document-chunking-vectorization.md`

有问题？查看上述文档或提交 GitHub Issue！
