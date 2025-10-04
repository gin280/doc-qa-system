# Supabase Storage配置指南

本文档指导如何为Story 2.2配置Supabase Storage。

## 前提条件

- 已有Supabase账号
- 已创建Supabase项目

## 配置步骤

### 1. 创建Storage Bucket

1. 登录Supabase Dashboard: https://app.supabase.com
2. 选择你的项目
3. 导航到 **Storage** → **Buckets**
4. 点击 **New bucket**
5. 配置bucket:
   - **Name**: `documents`
   - **Public bucket**: ❌ (取消勾选,保持私有)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: 
     - `application/pdf`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
     - `application/msword`
     - `text/markdown`
     - `text/plain`

### 2. 配置RLS Policies

在SQL Editor中执行以下SQL创建RLS策略:

```sql
-- Policy 1: 用户可以上传到自己的目录
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: 用户可以读取自己的文件
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: 用户可以删除自己的文件
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. 获取API密钥

1. 导航到 **Settings** → **API**
2. 复制以下密钥:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public** key
   - **service_role** key (⚠️ 保密,仅服务端使用)

### 4. 配置环境变量

在项目根目录的 `.env.local` 文件中添加:

```bash
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Storage配置
SUPABASE_STORAGE_BUCKET=documents
```

### 5. 验证配置

运行以下命令测试连接:

```bash
npm run dev
```

然后尝试上传一个测试文件,查看控制台是否有错误。

## 安全注意事项

⚠️ **重要安全提示**:

1. **永远不要**将 `SUPABASE_SERVICE_ROLE_KEY` 暴露给客户端
2. **永远不要**将 `.env.local` 文件提交到Git仓库
3. RLS policies确保用户只能访问自己的文件
4. 定期检查Storage使用量和配额

## 故障排除

### 上传失败

如果上传失败,检查:

1. ✅ Bucket名称是否正确(`documents`)
2. ✅ RLS policies是否已创建
3. ✅ 环境变量是否正确配置
4. ✅ 用户是否已认证
5. ✅ 文件大小是否超过50MB

### 访问被拒绝

如果出现访问被拒绝错误:

1. 检查RLS policies是否正确配置
2. 确认用户已登录
3. 验证文件路径格式: `{userId}/{documentId}_{filename}`

## 测试

配置完成后,可以运行集成测试验证:

```bash
# 需要实际Supabase环境
npm test -- tests/integration/api/upload-storage.test.ts
```

## 参考资料

- [Supabase Storage文档](https://supabase.com/docs/guides/storage)
- [RLS Policies文档](https://supabase.com/docs/guides/auth/row-level-security)
- Story 2.2技术指导文档: `docs/stories/2.2-file-storage-metadata.md`

