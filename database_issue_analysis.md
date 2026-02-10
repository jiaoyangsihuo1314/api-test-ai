# 数据库路径不一致问题分析报告

## 🔍 问题确认

### 检查结果

1. **DATABASE_URL 配置错误**:
   ```
   DATABASE_URL="file:./prisma/dev.db"  ❌ 错误配置
   ```

2. **数据库文件位置**:
   - ✅ `prisma/dev.db` 存在（Python executor 使用）
   - ❌ `prisma/prisma/dev.db` 存在（Prisma 错误写入）

3. **Python executor 路径**:
   - 使用: `prisma/dev.db` ✅ 正确

---

## 🎯 根本原因

### 问题分析

**Prisma 路径解析规则**:
- Prisma 的 `file:` 协议中，相对路径是相对于 **`prisma/schema.prisma` 文件所在目录**
- `prisma/schema.prisma` 位于: `prisma/` 目录
- `file:./prisma/dev.db` 会被解析为: `prisma/` + `prisma/dev.db` = `prisma/prisma/dev.db` ❌

**Python executor 路径**:
- 使用绝对路径计算: `executor/../prisma/dev.db` = `prisma/dev.db` ✅

**结果**:
- **Prisma (Next.js)**: 写入到 `prisma/prisma/dev.db` ❌
- **Python executor**: 读取 `prisma/dev.db` ✅
- **两个不同的数据库文件！**

---

## 📊 数据流向图

```
┌─────────────────────────────────────────────────────────┐
│  前端 (Next.js) - 创建执行记录                            │
│  DATABASE_URL="file:./prisma/dev.db"                     │
│  Prisma 解析为: prisma/prisma/dev.db                     │
│  └─> 写入: prisma/prisma/dev.db                          │
└─────────────────────────────────────────────────────────┘
                        │
                        │ ❌ 写入到错误位置
                        ▼
            ┌───────────────────────┐
            │ prisma/prisma/dev.db  │
            │ (Prisma 写入)         │
            └───────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Python Executor - 查询执行记录                          │
│  DB_PATH = prisma/dev.db                                │
│  └─> 读取: prisma/dev.db                                │
└─────────────────────────────────────────────────────────┘
                        │
                        │ ✅ 读取正确位置
                        ▼
            ┌───────────────────────┐
            │ prisma/dev.db         │
            │ (Python 读取)         │
            └───────────────────────┘

结果: 两个不同的数据库文件，数据不一致！
```

---

## 🔧 解决方案

### 方案 1: 修复 DATABASE_URL 配置（推荐）

**步骤**:

1. **修改 `.env` 文件**:
   ```bash
   # 错误配置（当前）
   DATABASE_URL="file:./prisma/dev.db"
   
   # 正确配置（修改为）
   DATABASE_URL="file:./dev.db"
   ```

2. **迁移数据** (如果需要保留现有数据):
   ```bash
   # 将 prisma/prisma/dev.db 的数据迁移到 prisma/dev.db
   # 或者直接使用 prisma/dev.db（如果它包含正确的数据）
   ```

3. **删除错误的数据库文件**:
   ```bash
   # 删除嵌套路径的数据库文件
   rm -rf prisma/prisma/dev.db
   # 或 Windows:
   rmdir /s prisma\prisma\dev.db
   ```

4. **重启服务**:
   - 重启 Next.js 开发服务器
   - 重启 Python executor

---

### 方案 2: 统一使用绝对路径

**修改 `.env`**:
```bash
# Windows
DATABASE_URL="file:D:/AutoTest/aitestmind-main/prisma/dev.db"

# Linux/Mac
DATABASE_URL="file:/path/to/project/prisma/dev.db"
```

**优点**: 路径明确，不会出错
**缺点**: 路径硬编码，不利于跨环境部署

---

### 方案 3: 修改 Python executor 路径（不推荐）

**修改 `executor/main.py`**:
```python
# 改为读取 prisma/prisma/dev.db
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "prisma", "prisma", "dev.db")
```

**缺点**: 
- 不符合项目结构
- 其他工具可能也使用 `prisma/dev.db`
- 维护困难

---

## 📝 验证步骤

### 1. 检查配置

```bash
# 检查 .env 文件
cat .env | grep DATABASE_URL
# 应该显示: DATABASE_URL="file:./dev.db"
```

### 2. 检查数据库文件

```bash
# 检查正确的数据库文件
ls -la prisma/dev.db
# 应该存在

# 检查错误的数据库文件
ls -la prisma/prisma/dev.db
# 应该不存在（修复后）
```

### 3. 测试执行流程

1. 修改 `.env` 文件
2. 重启 Next.js 服务
3. 创建一个测试套件执行
4. 检查执行记录是否能在 Python executor 中查询到

---

## 🚨 注意事项

### 数据迁移

如果 `prisma/prisma/dev.db` 中有重要数据：

1. **备份两个数据库**:
   ```bash
   cp prisma/dev.db prisma/dev.db.backup
   cp prisma/prisma/dev.db prisma/prisma/dev.db.backup
   ```

2. **合并数据** (如果需要):
   - 使用之前创建的迁移脚本
   - 或手动导出/导入数据

3. **选择主数据库**:
   - 如果 `prisma/dev.db` 有更多数据，保留它
   - 如果 `prisma/prisma/dev.db` 有更多数据，迁移到 `prisma/dev.db`

---

## 📋 修复清单

- [ ] 修改 `.env` 文件中的 `DATABASE_URL` 为 `"file:./dev.db"`
- [ ] 备份现有数据库文件
- [ ] 迁移数据（如果需要）
- [ ] 删除 `prisma/prisma/dev.db` 文件
- [ ] 重启 Next.js 服务
- [ ] 重启 Python executor
- [ ] 测试执行套件功能
- [ ] 验证执行记录能正常查询

---

## 🎯 总结

**问题根源**: `DATABASE_URL="file:./prisma/dev.db"` 配置错误，导致 Prisma 写入到嵌套路径 `prisma/prisma/dev.db`，而 Python executor 读取 `prisma/dev.db`，两个不同的数据库文件导致数据不一致。

**解决方案**: 修改 `.env` 文件中的 `DATABASE_URL` 为 `"file:./dev.db"`，确保 Prisma 和 Python executor 使用同一个数据库文件。

**优先级**: 🔴 高 - 必须立即修复，否则执行记录无法正常查询。
