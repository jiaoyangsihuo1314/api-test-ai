# 数据库路径不一致和时序问题分析

## 问题描述

**现象**: Python executor 查询执行记录时找不到记录，但前端（Next.js）已经创建了记录。

**错误日志**:
```
测试套件执行记录不存在: cmkb07lsg0040ib3wnl3qjh2s
更新成功，影响行数: 0
警告: 未找到执行记录
```

## 数据库路径配置分析

### 1. Python Executor 数据库路径

**文件**: `executor/main.py` 第 21 行

```python
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db")
```

**解析**:
- `os.path.dirname(__file__)` = `executor/` 目录
- `".."` = 项目根目录
- 最终路径: `prisma/dev.db`（相对于项目根目录）

**绝对路径示例**: `D:\AutoTest\aitestmind-main\prisma\dev.db`

---

### 2. Prisma (Next.js) 数据库路径

**文件**: `prisma/schema.prisma` 第 10 行

```prisma
url = env("DATABASE_URL")
```

**配置来源**: `.env` 文件中的 `DATABASE_URL` 环境变量

**默认配置** (从 `env.example`):
```bash
DATABASE_URL="file:./dev.db"
```

**路径解析规则**:
- Prisma 的 `file:` 协议中，相对路径是相对于 **`prisma/schema.prisma` 文件所在目录**
- 即：`prisma/schema.prisma` 所在目录 = `prisma/`
- `file:./dev.db` = `prisma/dev.db` ✅
- `file:./prisma/dev.db` = `prisma/prisma/dev.db` ❌（错误！）

---

### 3. 路径不一致的可能原因

#### 原因 1: DATABASE_URL 配置错误

**错误配置**:
```bash
DATABASE_URL="file:./prisma/dev.db"  # ❌ 错误
```

**解析结果**:
- Prisma 会解析为: `prisma/prisma/dev.db`（嵌套路径）
- Python executor 使用: `prisma/dev.db`
- **结果**: 两个不同的数据库文件！

**正确配置**:
```bash
DATABASE_URL="file:./dev.db"  # ✅ 正确
```

**解析结果**:
- Prisma 解析为: `prisma/dev.db`
- Python executor 使用: `prisma/dev.db`
- **结果**: 同一个数据库文件 ✅

---

#### 原因 2: 工作目录不一致

**场景**: 
- Next.js 从项目根目录启动
- Python executor 从 `executor/` 目录启动

**影响**:
- 如果使用相对路径，可能导致路径解析不一致
- 但代码中使用了 `os.path.dirname(__file__)`，应该不受工作目录影响

---

#### 原因 3: 数据库文件位置历史遗留

**历史问题** (从 `setup.sh` 可见):
```bash
# 检查并修复 DATABASE_URL 配置
CURRENT_DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"')
if [ "$CURRENT_DB_URL" = "file:./prisma/dev.db" ]; then
    echo "⚠ 检测到错误的 DATABASE_URL 配置，正在修复..."
    sed -i 's|DATABASE_URL="file:./prisma/dev.db"|DATABASE_URL="file:./dev.db"|g' .env
fi

# 修复嵌套的数据库路径
if [ -f "prisma/prisma/dev.db" ]; then
    mv prisma/prisma/dev.db prisma/dev.db
fi
```

**说明**: 之前确实存在过路径配置错误的问题！

---

## 时序问题分析

### 执行流程

1. **前端创建执行记录** (`app/api/test-suites/[id]/execute/route.ts` 第 113 行):
   ```typescript
   const execution = await prisma.testSuiteExecution.create({...});
   ```

2. **立即调用 Python executor** (第 143 行):
   ```typescript
   const executorResponse = await fetch(endpoint, {
     method: 'POST',
     body: JSON.stringify({
       suite_execution_id: execution.id,
       ...
     }),
   });
   ```

3. **Python executor 查询记录** (`executor/suite_executor.py` 第 73 行):
   ```python
   suite_execution = self.database.get_suite_execution(suite_execution_id)
   ```

### 可能的时序问题

#### 问题 1: 数据库事务未提交

**场景**:
- Prisma 创建记录后，事务可能还未提交
- Python executor 立即查询，可能读取不到

**分析**:
- Prisma 默认使用自动提交，`create()` 操作会立即提交
- **可能性**: 低

#### 问题 2: SQLite 文件锁定

**场景**:
- Prisma 写入时锁定数据库文件
- Python executor 读取时被阻塞或读取失败

**分析**:
- SQLite 支持并发读取，但写入时会短暂锁定
- **可能性**: 中等（如果写入操作耗时较长）

#### 问题 3: 文件系统缓存延迟

**场景**:
- Windows 文件系统可能有缓存延迟
- 写入操作完成，但文件系统缓存未刷新
- Python executor 读取时看不到新数据

**分析**:
- Windows 文件系统确实可能有缓存
- **可能性**: 中等（在 Windows 上更常见）

#### 问题 4: 数据库连接池缓存

**场景**:
- Prisma 使用连接池
- Python executor 使用独立的 SQLite 连接
- 可能存在连接级别的缓存不一致

**分析**:
- SQLite 是文件数据库，连接池主要影响性能
- **可能性**: 低

---

## 诊断方法

### 1. 检查 DATABASE_URL 配置

```bash
# 检查 .env 文件
cat .env | grep DATABASE_URL

# 应该看到:
# DATABASE_URL="file:./dev.db"  ✅ 正确
# 或
# DATABASE_URL="file:./prisma/dev.db"  ❌ 错误
```

### 2. 检查数据库文件位置

```bash
# 检查是否存在嵌套路径
ls -la prisma/prisma/dev.db  # 如果存在，说明配置错误

# 检查正确的数据库文件
ls -la prisma/dev.db  # 应该存在
```

### 3. 验证数据库内容

```python
# Python 脚本检查
import sqlite3
db_path = 'prisma/dev.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id FROM TestSuiteExecution ORDER BY startTime DESC LIMIT 5")
print(cursor.fetchall())
```

### 4. 检查执行记录创建时间

```sql
-- 在 Prisma Studio 或 SQLite 客户端中执行
SELECT id, suiteName, status, startTime, createdAt 
FROM TestSuiteExecution 
ORDER BY startTime DESC 
LIMIT 10;
```

---

## 解决方案

### 方案 1: 统一数据库路径配置（推荐）

**步骤**:
1. 检查 `.env` 文件中的 `DATABASE_URL`
2. 确保配置为: `DATABASE_URL="file:./dev.db"`
3. 如果配置错误，修改后重启 Next.js 服务

### 方案 2: 添加重试机制

**在 Python executor 中**:
```python
# 如果记录不存在，等待一小段时间后重试
import time

suite_execution = self.database.get_suite_execution(suite_execution_id)
if not suite_execution:
    # 等待 100ms 后重试
    time.sleep(0.1)
    suite_execution = self.database.get_suite_execution(suite_execution_id)
    if not suite_execution:
        raise Exception(f"测试套件执行记录不存在: {suite_execution_id}")
```

### 方案 3: 使用数据库同步机制

**确保写入完成**:
```typescript
// 在创建记录后，显式等待
const execution = await prisma.testSuiteExecution.create({...});
await prisma.$disconnect(); // 确保连接关闭，数据写入完成
// 然后再调用 executor
```

### 方案 4: 使用相同的数据库连接

**统一使用 Prisma**:
- 将 Python executor 也改为使用 Prisma Client
- 但这需要较大的代码重构

---

## 推荐检查清单

- [ ] 检查 `.env` 文件中的 `DATABASE_URL` 配置
- [ ] 确认 `prisma/dev.db` 文件存在且可读写
- [ ] 检查是否存在 `prisma/prisma/dev.db`（错误路径）
- [ ] 验证执行记录是否真的被创建（在数据库中查询）
- [ ] 检查 Python executor 的数据库路径是否正确
- [ ] 测试执行流程，观察时序问题

---

## 总结

**最可能的原因**:
1. **DATABASE_URL 配置错误** - 使用了 `file:./prisma/dev.db` 导致路径嵌套
2. **文件系统缓存延迟** - Windows 上的文件系统缓存导致读取延迟

**建议**:
1. 首先检查并修复 `DATABASE_URL` 配置
2. 如果问题仍然存在，考虑添加重试机制
3. 在关键位置添加日志，记录数据库路径和查询结果
