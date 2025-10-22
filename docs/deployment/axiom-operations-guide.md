# Axiom 运维操作指南

本指南提供 Axiom 日志系统的日常运维操作、故障排查和最佳实践。

---

## 📋 目录

1. [Dashboard 配置](#1-dashboard-配置)
2. [告警规则管理](#2-告警规则管理)
3. [常用查询语句](#3-常用查询语句)
4. [配额监控和优化](#4-配额监控和优化)
5. [故障排查指南](#5-故障排查指南)
6. [日常运维任务](#6-日常运维任务)

---

## 1️⃣ Dashboard 配置

### 1.1 创建 Saved Queries

Saved Queries 可以快速访问常用的日志查询。

#### Query 1: 错误日志查询

**用途**: 查看所有错误和致命错误

```apl
['level'] == 50 or ['level'] == 60
| sort by ['_time'] desc
| limit 100
```

**保存步骤**:
1. 在 Axiom 查询编辑器中输入上述查询
2. 点击 **"Save"** → **"Save as new"**
3. 名称: `错误日志 (Errors)`
4. 描述: `显示所有 error 和 fatal 级别的日志`

#### Query 2: 文档上传日志

**用途**: 监控文档上传活动

```apl
['action'] contains "upload"
| summarize count() by bin_auto(['_time']), ['action']
| sort by ['_time'] desc
```

**保存为**: `文档上传活动 (Uploads)`

#### Query 3: RAG 查询日志

**用途**: 分析查询性能和成功率

```apl
['action'] contains "query" or ['action'] contains "retrieval" or ['action'] contains "generation"
| summarize 
    平均检索时间=avg(['retrievalTime']),
    平均生成时间=avg(['generationTime']),
    总查询数=count()
  by bin_auto(['_time'])
| sort by ['_time'] desc
```

**保存为**: `RAG 查询分析 (Query Analytics)`

#### Query 4: 缓存命中率 (如果 Story 4.2 已完成)

**用途**: 监控缓存性能

```apl
['action'] contains "cache"
| summarize 
    hits=countif(['action']=="cache_hit"),
    misses=countif(['action']=="cache_miss")
  by bin_auto(['_time'])
| extend hitRate = hits * 100.0 / (hits + misses)
| sort by ['_time'] desc
```

**保存为**: `缓存命中率 (Cache Hit Rate)`

---

### 1.2 创建监控 Dashboard

#### Dashboard 名称
`DocQA System - Production Monitoring`

#### Panel 1: 错误趋势 (24小时)

**类型**: Line Chart

**查询**:
```apl
['level'] >= 50
| summarize count() by bin(1h, ['_time'])
| sort by ['_time'] desc
```

**配置**:
- X 轴: Time
- Y 轴: Count
- 时间范围: Last 24 hours
- 刷新间隔: 5 minutes

#### Panel 2: 请求量分布 (按 Action)

**类型**: Bar Chart

**查询**:
```apl
['action'] != ""
| summarize count() by ['action']
| order by ['count_'] desc
| limit 10
```

**配置**:
- X 轴: Action
- Y 轴: Count
- 时间范围: Last 1 hour

#### Panel 3: 平均响应时间

**类型**: Line Chart

**查询**:
```apl
['retrievalTime'] > 0 or ['generationTime'] > 0
| summarize 
    平均检索=avg(['retrievalTime']),
    平均生成=avg(['generationTime'])
  by bin(5m, ['_time'])
| sort by ['_time'] desc
```

**配置**:
- 多条线: 检索时间 / 生成时间
- 时间范围: Last 6 hours

#### Panel 4: 缓存命中率 (可选)

**类型**: Area Chart

**查询**: (使用 Saved Query #4)

**配置**:
- Y 轴: Hit Rate (%)
- 目标线: 80% (理想命中率)
- 时间范围: Last 24 hours

#### Panel 5: Top 错误类型

**类型**: Table

**查询**:
```apl
['level'] >= 50
| summarize 
    错误次数=count(),
    最后发生=max(['_time'])
  by ['error']
| order by ['错误次数'] desc
| limit 20
```

**配置**:
- 列: 错误类型, 次数, 最后发生时间
- 时间范围: Last 24 hours

---

## 2️⃣ 告警规则管理

### 2.1 创建告警通知渠道

在配置告警前，先设置通知方式:

1. 进入 **Settings** → **Notifications**
2. 点击 **"New Notification"**
3. 选择通知类型:
   - **Email**: 输入运维团队邮箱
   - **Slack** (可选): 连接 Slack workspace
   - **Webhook** (可选): 自定义 webhook URL

### 2.2 告警规则 1: 高错误率

**用途**: 当错误率过高时发送告警

**查询**:
```apl
['level'] >= 50
| summarize 错误数=count() by bin(5m, ['_time'])
| where ['错误数'] > 20
```

**配置**:
- **名称**: `高错误率告警`
- **描述**: `5分钟内错误超过20次`
- **触发条件**: `错误数 > 20`
- **评估间隔**: 5 minutes
- **通知**: Email + Slack (如果已配置)
- **严重性**: High

**保存并启用告警**

### 2.3 告警规则 2: 文档上传失败激增

**用途**: 监控上传功能异常

**查询**:
```apl
['action'] == "upload_error"
| summarize 失败数=count() by bin(1h, ['_time'])
| where ['失败数'] > 10
```

**配置**:
- **名称**: `上传失败告警`
- **描述**: `1小时内上传失败超过10次`
- **触发条件**: `失败数 > 10`
- **评估间隔**: 15 minutes
- **通知**: Email
- **严重性**: Medium

### 2.4 告警规则 3: Axiom 配额告警

**用途**: 防止配额耗尽

**手动监控** (Axiom 免费版不支持自动配额告警):

1. 每周一检查: Settings → Usage
2. 如果月度使用 > 400GB (80%):
   - 立即通知团队
   - 评估是否需要优化日志策略
   - 考虑升级计划

**配额告警阈值**:
- 🟢 **< 300GB (60%)**: 正常
- 🟡 **300-400GB (60-80%)**: 注意
- 🟠 **400-450GB (80-90%)**: 警告
- 🔴 **> 450GB (90%)**: 紧急

---

## 3️⃣ 常用查询语句

### 3.1 错误排查

#### 查询用户特定错误

```apl
['userId'] == "user-123"
| where ['level'] >= 50
| sort by ['_time'] desc
| limit 50
```

#### 查询特定时间段的错误

```apl
['level'] >= 50
| where ['_time'] >= datetime('2025-01-15T10:00:00Z')
| where ['_time'] <= datetime('2025-01-15T11:00:00Z')
| order by ['_time'] asc
```

#### 查询特定文档的处理日志

```apl
['documentId'] == "doc-abc-123"
| order by ['_time'] asc
| project ['_time'], ['action'], ['error'], ['processingTime']
```

### 3.2 性能分析

#### 查询慢请求 (检索时间 > 2 秒)

```apl
['retrievalTime'] > 2000
| project ['_time'], ['userId'], ['queryPreview'], ['retrievalTime'], ['chunksFound']
| order by ['retrievalTime'] desc
| limit 50
```

#### 分析每小时的平均性能

```apl
| summarize 
    平均检索=avg(['retrievalTime']),
    P95检索=percentile(['retrievalTime'], 95),
    平均生成=avg(['generationTime']),
    请求数=count()
  by bin(1h, ['_time'])
| order by ['_time'] desc
```

### 3.3 业务指标

#### 统计每日活跃用户

```apl
['userId'] != ""
| summarize 活跃用户=dcount(['userId']) by bin(1d, ['_time'])
| order by ['_time'] desc
```

#### 统计文档上传量

```apl
['action'] == "upload_success"
| summarize 
    上传成功=count(),
    总大小MB=sum(['fileSize']) / 1024 / 1024
  by bin(1d, ['_time'])
| order by ['_time'] desc
```

#### 查询成功率分析

```apl
['action'] contains "query" or ['action'] contains "generation"
| summarize 
    总数=count(),
    成功=countif(['action'] == "generation_success"),
    失败=countif(['action'] contains "error")
  by bin(1h, ['_time'])
| extend 成功率 = 成功 * 100.0 / 总数
| order by ['_time'] desc
```

### 3.4 缓存监控

#### 缓存命中率 (小时级别)

```apl
['action'] contains "cache"
| summarize 
    命中=countif(['action']=="cache_hit"),
    未命中=countif(['action']=="cache_miss")
  by bin(1h, ['_time'])
| extend 命中率=命中*100.0/(命中+未命中)
| order by ['_time'] desc
```

#### 缓存损坏事件

```apl
['action'] == "cache_corrupted"
| project ['_time'], ['cacheKey'], ['service']
| order by ['_time'] desc
```

---

## 4️⃣ 配额监控和优化

### 4.1 检查当前配额使用

1. 登录 Axiom Dashboard
2. 进入 **Settings** → **Usage**
3. 查看 **Current Period**:
   - 已使用: XXX GB / 500 GB
   - 剩余天数: XX days
   - 平均每日: XX GB/day

### 4.2 配额使用预警

**每周检查清单**:

- [ ] 查看月度累计使用量
- [ ] 计算平均每日使用量
- [ ] 预估本月总使用量
- [ ] 如果预估 > 400GB，执行优化措施

**计算公式**:
```
预估月度使用 = 当前使用 / 已过天数 × 30
```

### 4.3 配额优化策略

#### 策略 1: 提高日志过滤级别

如果配额紧张，修改 logger 配置只发送 `fatal` 级别:

```typescript
// src/lib/logger.ts
transport: {
  target: 'pino-axiom',
  options: {
    // 从 ['error', 'fatal'] 改为只 ['fatal']
    levels: ['fatal']
  }
}
```

**预估节省**: 50-70% (取决于 error vs fatal 比例)

#### 策略 2: 采样策略

实施日志采样，只发送 10% 的 info 日志:

```typescript
// 在 logger 中添加采样逻辑
if (level === 'info' && Math.random() > 0.1) {
  return; // 跳过 90% 的 info 日志
}
```

**预估节省**: 如果 info 日志占大部分，可节省 40-60%

#### 策略 3: 过滤冗余日志

识别并过滤高频但价值低的日志:

```apl
# 查询最频繁的日志类型
| summarize count() by ['action']
| order by ['count_'] desc
| limit 20
```

考虑过滤:
- 健康检查日志 (如果太频繁)
- 成功的缓存命中 (保留未命中即可)
- 重复的信息性日志

#### 策略 4: 升级付费计划

如果优化后仍不够用，考虑升级:

| 计划 | 月费 | 摄入量 | 适用场景 |
|-----|------|--------|---------|
| Free | $0 | 500GB | MVP 阶段 |
| Startup | $25 | 1TB | 小规模生产 |
| Team | $99 | 5TB | 中等规模 |

---

## 5️⃣ 故障排查指南

### 5.1 用户报告上传失败

**排查步骤**:

1. **获取用户信息**: userId, 文件名, 错误时间
2. **查询上传日志**:
   ```apl
   ['userId'] == "<user-id>"
   | where ['action'] contains "upload"
   | where ['_time'] >= ago(1h)
   | order by ['_time'] desc
   ```

3. **检查错误详情**:
   - 查看 `error` 字段
   - 检查 `fileSize` 是否超限
   - 确认 `fileName` 格式

4. **常见原因**:
   - 文件大小超限 → 提示用户
   - 文件类型不支持 → 查看 parserService 日志
   - 存储服务异常 → 检查 Supabase 状态

### 5.2 查询响应慢

**排查步骤**:

1. **查询慢请求**:
   ```apl
   ['retrievalTime'] > 2000 or ['generationTime'] > 5000
   | project ['_time'], ['userId'], ['queryPreview'], 
            ['retrievalTime'], ['generationTime'], ['chunksFound']
   | order by ['_time'] desc
   | limit 20
   ```

2. **分析原因**:
   - **检索慢**: `retrievalTime` 高 → 向量搜索问题
   - **生成慢**: `generationTime` 高 → LLM API 延迟
   - **分块多**: `chunksFound` 过多 → 查询过于宽泛

3. **解决方案**:
   - 检查向量数据库性能
   - 监控 LLM API 状态
   - 优化查询重写策略

### 5.3 突然出现大量错误

**应急响应**:

1. **快速评估影响范围**:
   ```apl
   ['level'] >= 50
   | where ['_time'] >= ago(10m)
   | summarize 
       错误数=count(),
       影响用户=dcount(['userId']),
       错误类型=make_set(['error'])
     by bin(1m, ['_time'])
   ```

2. **识别根本原因**:
   - 查看最常见的错误消息
   - 检查是否集中在特定 action
   - 确认是否有最近部署

3. **止损措施**:
   - 如果是新部署导致 → 回滚到上一版本
   - 如果是外部服务故障 → 启用降级模式
   - 如果是配额耗尽 → 紧急扩容

### 5.4 日志未出现在 Axiom

**检查清单**:

- [ ] 确认 `NODE_ENV=production`
- [ ] 验证 `AXIOM_TOKEN` 已配置
- [ ] 检查日志级别 (只有 error/fatal 发送到 Axiom)
- [ ] 查看 Vercel 部署日志是否有错误
- [ ] 确认 Axiom Token 未被吊销
- [ ] 测试网络连接到 Axiom API

**测试命令**:
```bash
# 在 Vercel 函数中测试
curl -X POST https://api.axiom.co/v1/datasets/docqa-system/ingest \
  -H "Authorization: Bearer $AXIOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"level":50,"msg":"test"}]'
```

---

## 6️⃣ 日常运维任务

### 6.1 每日任务

**时间**: 每天 上午 10:00

- [ ] 检查 Dashboard - 是否有异常趋势
- [ ] 查看告警通知 - 处理未解决的告警
- [ ] 查询错误日志 - 确认无新的严重错误
- [ ] 检查性能指标 - 响应时间是否正常

**检查命令**:
```apl
# 昨天的错误总结
['level'] >= 50
| where ['_time'] >= ago(24h)
| summarize 
    总错误=count(),
    影响用户=dcount(['userId']),
    Top错误=take_any(['error'], 5)
```

### 6.2 每周任务

**时间**: 每周一 上午 10:00

- [ ] 检查配额使用 (Settings → Usage)
- [ ] 审查 Top 错误类型 - 是否需要修复
- [ ] 分析性能趋势 - 是否有恶化
- [ ] 更新告警规则 - 根据实际情况调整阈值
- [ ] 备份重要查询 - 导出 Saved Queries

**配额检查**:
```
当前使用: XXX GB / 500 GB
预估月度: XXX GB (是否超限?)
优化建议: [如有需要]
```

### 6.3 每月任务

**时间**: 每月 1 号

- [ ] 生成月度报告 - 错误、性能、业务指标
- [ ] 配额复盘 - 评估是否需要优化或升级
- [ ] 告警有效性评估 - 调整误报规则
- [ ] 文档更新 - 更新常见问题和解决方案
- [ ] 培训团队 - 分享重要发现和最佳实践

**月度报告模板**:
```markdown
## DocQA 系统运维月报 - [YYYY年MM月]

### 系统健康度
- 总错误数: XXX (环比 ±XX%)
- 平均响应时间: XXX ms
- 系统可用性: XX.X%

### Axiom 配额
- 月度使用: XXX GB / 500 GB
- 平均每日: XX GB/day
- 优化措施: [如有]

### Top 问题
1. [问题描述] - 发生次数 - 解决状态
2. ...

### 改进建议
- [建议 1]
- [建议 2]
```

---

## 📚 参考资源

### 官方文档
- **Axiom APL 查询语言**: https://axiom.co/docs/apl/introduction
- **Axiom Dashboard 指南**: https://axiom.co/docs/dashboards/dashboards
- **Axiom 告警配置**: https://axiom.co/docs/alerts/alerts

### 项目文档
- **Logger 使用指南**: `docs/architecture/logging-guide.md`
- **Axiom 配置指南**: `docs/deployment/axiom-logging-setup.md`
- **架构文档**: `docs/architecture.md` (第 3323-3492 行)

### QA 文档
- **Story 4.12**: `docs/stories/4.12-axiom-logging-integration.md`
- **QA Gate**: `docs/qa/gates/4.12-axiom-logging-integration.yml`
- **测试报告**: `docs/qa/assessments/4.12-*`

---

## 🆘 紧急联系方式

**运维团队邮箱**: ops@docqa-system.com (替换为实际邮箱)

**紧急故障响应**:
1. 立即检查 Axiom Dashboard 和告警
2. 查看最近的部署和变更
3. 在团队群组发送故障通知
4. 按照故障排查指南执行诊断
5. 记录故障处理过程和结果

---

**最后更新**: 2025-01-15  
**维护者**: DevOps Team  
**Story**: 4.12 - Axiom 日志集成

