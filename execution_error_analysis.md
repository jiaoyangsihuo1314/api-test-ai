# 测试套件执行 500 错误分析

## 问题 1: 参数名错误

### 错误信息
```
TypeError: Database.create_execution_log() got an unexpected keyword argument 'type'
```

### 问题位置
**文件**: `executor/suite_executor.py`  
**行号**: 290

### 问题代码
```python
self.database.create_execution_log(
    level='error',
    message=f'测试套件执行异常: {str(e)}',
    suite_execution_id=suite_execution_id,
    type='system'  # ❌ 错误：应该是 log_type
)
```

### 正确代码
```python
self.database.create_execution_log(
    level='error',
    message=f'测试套件执行异常: {str(e)}',
    suite_execution_id=suite_execution_id,
    log_type='system'  # ✅ 正确：参数名是 log_type
)
```

### 原因分析
- `create_execution_log` 方法的参数定义是 `log_type`（第 864 行）
- 但在异常处理中使用了 `type` 参数
- Python 不支持参数名自动转换，必须使用准确的参数名

### 对比
其他所有调用 `create_execution_log` 的地方都正确使用了 `log_type`：
- 第 67 行: `log_type='system'` ✅
- 第 90 行: `log_type='system'` ✅
- 第 105 行: `log_type='system'` ✅
- 第 135 行: `log_type='system'` ✅
- 第 182 行: `log_type='system'` ✅
- 第 203 行: `log_type='error'` ✅
- 第 231 行: `log_type='error'` ✅
- **第 290 行: `type='system'`** ❌ **唯一错误的地方**

---

## 问题 2: 测试套件执行记录不存在

### 错误信息
```
Exception: 测试套件执行记录不存在: cmkazolnj003tib3wk8kx640h
```

### 问题位置
**文件**: `executor/suite_executor.py`  
**行号**: 73-75

### 问题代码
```python
suite_execution = self.database.get_suite_execution(suite_execution_id)
if not suite_execution:
    raise Exception(f"测试套件执行记录不存在: {suite_execution_id}")
```

### 可能的原因

#### 1. 前端未创建执行记录
- 前端在执行测试套件前，应该先调用 API 创建 `TestSuiteExecution` 记录
- 如果前端直接调用 `/api/execute-suite` 而没有先创建执行记录，就会出现此错误

#### 2. 执行记录 ID 传递错误
- 前端可能传递了错误的 `suite_execution_id`
- 或者传递了 `suite_id` 而不是 `suite_execution_id`

#### 3. 执行记录被删除
- 执行记录可能被其他操作删除
- 或者数据库事务回滚导致记录未保存

#### 4. 数据库路径不一致
- 之前遇到过数据库路径不一致的问题（`prisma/dev.db` vs `prisma/prisma/dev.db`）
- 如果前端写入的数据库和 executor 读取的数据库不是同一个，就会出现此问题

### 检查方法

1. **检查数据库中的执行记录**:
   ```sql
   SELECT id, suiteId, suiteName, status, startTime 
   FROM TestSuiteExecution 
   WHERE id = 'cmkazolnj003tib3wk8kx640h';
   ```

2. **检查前端代码**:
   - 查看测试套件执行的前端代码
   - 确认是否在执行前创建了 `TestSuiteExecution` 记录
   - 确认传递的 `suite_execution_id` 是否正确

3. **检查 API 调用顺序**:
   - 应该先调用创建执行记录的 API
   - 然后再调用 `/api/execute-suite`

---

## 修复建议

### 修复 1: 参数名错误（必须修复）
将 `executor/suite_executor.py` 第 290 行的 `type='system'` 改为 `log_type='system'`

### 修复 2: 执行记录不存在（需要检查）
1. 检查前端代码，确认执行流程
2. 如果前端未创建执行记录，需要：
   - 在执行前创建 `TestSuiteExecution` 记录
   - 或者修改后端，在执行时自动创建记录（如果不存在）

---

## 总结

**主要问题**: 参数名拼写错误（`type` vs `log_type`）

**次要问题**: 执行记录不存在，需要检查前端执行流程和数据库路径一致性
