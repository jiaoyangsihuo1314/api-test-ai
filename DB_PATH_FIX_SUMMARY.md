# 数据库路径统一修复总结

## ✅ 已完成的修复

### 1. Python Executor 数据库路径
**文件**: `executor/main.py`
- **修复前**: `prisma/prisma/dev.db` ❌
- **修复后**: `prisma/dev.db` ✅
- **状态**: ✅ 已修复

### 2. 配置文件检查
**文件**: `.env`
- **配置**: `DATABASE_URL="file:./dev.db"` ✅
- **说明**: 相对于 `prisma/schema.prisma`，正确指向 `prisma/dev.db`
- **状态**: ✅ 正确

### 3. 其他Python文件检查
以下文件已确认使用正确的路径 `prisma/dev.db`:
- ✅ `executor/fix_execution_stats.py`
- ✅ `executor/test_no_auth.py`
- ✅ `executor/test_example.py`

## 📋 系统组件数据库路径汇总

| 组件 | 文件/配置 | 数据库路径 | 状态 |
|------|----------|-----------|------|
| **Prisma (Next.js)** | `.env` → `DATABASE_URL` | `prisma/dev.db` | ✅ 正确 |
| **Python Executor** | `executor/main.py` | `prisma/dev.db` | ✅ 已修复 |
| **测试脚本** | `executor/test_*.py` | `prisma/dev.db` | ✅ 正确 |
| **修复脚本** | `executor/fix_execution_stats.py` | `prisma/dev.db` | ✅ 正确 |

## ⚠️ 需要注意的问题

### Prisma Client 可能需要重新生成
虽然配置已正确，但Prisma Client可能缓存了旧的路径。建议执行：

```bash
npx prisma generate
```

### 数据库文件状态
- ✅ `prisma/dev.db` - 主数据库（17个API，包含旧数据）
- ⚠️ `prisma/prisma/dev.db` - 旧数据库（1个API，最新数据）

**建议操作**:
1. 如果 `prisma/prisma/dev.db` 中有重要数据，先迁移到 `prisma/dev.db`
2. 删除 `prisma/prisma/dev.db` 文件
3. 重新生成 Prisma Client
4. 重启所有服务

## 🔧 后续步骤

1. **重新生成 Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **验证数据库路径**（可选）:
   ```bash
   python verify_db_paths.py
   ```

3. **重启服务**:
   - 重启 Next.js 开发服务器
   - 重启 Python executor 服务

4. **测试验证**:
   - 测试API采集保存功能
   - 测试测试套件执行功能
   - 确认所有数据都保存到 `prisma/dev.db`

## 📝 配置说明

### Prisma 路径解析规则
- `DATABASE_URL="file:./dev.db"` 中的相对路径是相对于 `prisma/schema.prisma` 文件所在目录
- 即：`prisma/schema.prisma` 所在目录 = `prisma/`
- 所以 `file:./dev.db` = `prisma/dev.db` ✅

### Python Executor 路径
- 使用 `os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db")`
- `__file__` = `executor/main.py`
- `os.path.dirname(__file__)` = `executor/`
- `".."` = 项目根目录
- 最终路径: `prisma/dev.db` ✅

## ✅ 修复完成

所有系统组件现在都统一使用 `prisma/dev.db` 数据库！
