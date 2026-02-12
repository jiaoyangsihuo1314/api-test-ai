# 数据库迁移指南 - 测试用例分类树功能

## 📋 更新说明

为了让测试套件的分类树与API仓库保持一致，我们做了以下改进：

### 主要变更
1. **后端API增强**：测试用例现在会自动从关联的API获取 `platform`, `component`, `feature` 分类信息
2. **数据库Schema更新**：添加了 `TestStep` 与 `Api` 的关系定义
3. **前端组件升级**：分类树现在使用四层分类结构展示

---

## 🔧 迁移步骤

### 1. 停止开发服务器

```bash
# 按 Ctrl+C 停止当前运行的 npm run dev
```

### 2. 生成并应用数据库迁移

```bash
# 生成迁移文件
npx prisma migrate dev --name add_teststep_api_relation

# 或者直接推送 schema 更改（适用于开发环境）
npx prisma db push
```

### 3. 重新生成 Prisma Client

```bash
npx prisma generate
```

### 4. 重启开发服务器

```bash
npm run dev
```

---

## 📊 数据结构说明

### 更新前
```typescript
// TestCase 只有 category 字段
{
  id: "xxx",
  name: "登录测试",
  category: "用户管理" // 简单的字符串分类
}
```

### 更新后
```typescript
// TestCase 从关联的 API 自动获取四层分类
{
  id: "xxx",
  name: "登录测试",
  category: "用户管理", // 保留向后兼容
  platform: "ITOMV",     // 从 API 获取
  component: "用户管理",  // 从 API 获取
  feature: "登录"        // 从 API 获取
}
```

---

## 🎯 分类获取逻辑

测试用例的分类信息来源：

1. **主要来源**：从测试用例的第一个API步骤获取 `platform/component/feature`
2. **降级策略**：
   - 如果步骤没有关联API → 显示在"未分类"
   - 如果API没有分类信息 → 使用默认值

示例：

```typescript
// 测试用例有以下步骤：
Step 1: API请求 (apiId: "api123")  // 该API的分类：ITOMV/用户管理/登录
Step 2: 断言 (无API)
Step 3: 等待 (无API)

// 结果：测试用例的分类为
{
  platform: "ITOMV",
  component: "用户管理",
  feature: "登录"
}
```

---

## 🌳 分类树显示效果

```
分类导航
用例总数: 15

📄 全部用例 (15)

> 📁 ITOMV (8)
  > 📁 用户管理 (3)
    📁 登录 (1)
    📁 注册 (1)
    📁 修改密码 (1)
  > 📁 订单管理 (5)
    📁 创建订单 (2)
    📁 查询订单 (2)
    📁 删除订单 (1)

> 📁 test-zz-rpa (5)
  📁 首页 (3)
  📁 用户管理 (2)

📁 未分类 (2)
```

---

## ⚠️ 注意事项

### 1. 数据兼容性
- ✅ **向后兼容**：保留了原有的 `category` 字段
- ✅ **无需数据迁移**：现有测试用例数据不需要修改
- ✅ **自动更新**：分类信息会在下次加载时自动从API获取

### 2. 分类一致性
- 测试用例的分类直接来源于其步骤中引用的API
- 如果要修改测试用例的分类，需要修改其引用的API的分类
- 建议在API仓库中统一管理分类结构

### 3. 性能考虑
- 后端查询会关联 `TestStep` → `Api` 表
- 添加了适当的索引优化查询性能
- 对于大量数据场景，已做分页处理

---

## 🧪 测试清单

迁移完成后，请验证以下功能：

- [ ] 测试套件列表页面正常加载
- [ ] 创建测试套件时，左侧分类树正常显示
- [ ] 点击分类节点，右侧用例列表正确筛选
- [ ] 展开/折叠分类树节点功能正常
- [ ] "全部用例"按钮功能正常
- [ ] "未分类"节点正确显示没有API的用例
- [ ] 搜索功能正常工作
- [ ] 选择用例并创建测试套件成功

---

## 🐛 故障排除

### 问题1：迁移失败

```bash
# 如果迁移失败，可以重置开发数据库
npx prisma migrate reset

# 然后重新迁移
npx prisma migrate dev
```

### 问题2：分类树不显示

**可能原因**：
1. 数据库迁移未执行
2. Prisma Client未重新生成
3. 开发服务器未重启

**解决方案**：
```bash
# 重新执行完整流程
npx prisma db push
npx prisma generate
npm run dev
```

### 问题3：用例显示在"未分类"

**原因**：该测试用例的步骤中没有关联API，或关联的API没有分类信息

**解决方案**：
1. 在用例编排页面，确保步骤中引用了API
2. 在API仓库中，给API设置 platform/component/feature 分类
3. 重新加载测试套件页面

---

## 📚 相关文档

- [测试用例分类树使用说明](./docs/TEST_CASE_TREE_USAGE.md)
- [Prisma Schema 文档](./prisma/schema.prisma)
- [API 四层分类说明](./docs/user-guide/02_API_REPOSITORY.md)

---

## 🎉 完成后

数据库迁移完成后，您可以：

1. 访问测试套件页面，查看新的分类树效果
2. 创建或编辑测试套件，体验四层分类筛选
3. 确认测试用例能够正确显示在对应的分类下

如有问题，请查看故障排除部分或联系技术支持。
