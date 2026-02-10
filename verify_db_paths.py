# -*- coding: utf-8 -*-
"""
验证所有组件使用的数据库路径
确保所有组件都统一使用 prisma/dev.db
"""
import os
import sys
import re

# 设置UTF-8输出
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 70)
print("数据库路径统一性检查")
print("=" * 70)

issues = []
correct_paths = []

# 1. 检查 .env 文件
print("\n1. 检查 .env 配置:")
env_path = '.env'
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'DATABASE_URL="file:./dev.db"' in content:
            print("   ✅ DATABASE_URL=\"file:./dev.db\" (正确)")
            correct_paths.append('.env: DATABASE_URL')
        elif 'DATABASE_URL="file:./prisma/dev.db"' in content:
            print("   ⚠️  DATABASE_URL=\"file:./prisma/dev.db\" (错误，会指向 prisma/prisma/dev.db)")
            issues.append('.env: DATABASE_URL 配置错误')
        else:
            print("   ⚠️  未找到或配置异常")
            issues.append('.env: DATABASE_URL 配置未找到')
else:
    print("   ❌ .env 文件不存在")
    issues.append('.env 文件不存在')

# 2. 检查 executor/main.py
print("\n2. 检查 executor/main.py:")
main_py = 'executor/main.py'
if os.path.exists(main_py):
    with open(main_py, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'prisma", "prisma", "dev.db"' in content:
            print("   ❌ 使用了 prisma/prisma/dev.db (错误)")
            issues.append('executor/main.py: 使用错误的数据库路径')
        elif 'prisma", "dev.db"' in content and 'prisma", "prisma"' not in content:
            print("   ✅ 使用 prisma/dev.db (正确)")
            correct_paths.append('executor/main.py')
        else:
            print("   ⚠️  无法确定路径")
            issues.append('executor/main.py: 路径配置不明确')
else:
    print("   ❌ 文件不存在")

# 3. 检查 executor/fix_execution_stats.py
print("\n3. 检查 executor/fix_execution_stats.py:")
fix_py = 'executor/fix_execution_stats.py'
if os.path.exists(fix_py):
    with open(fix_py, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'prisma" / "dev.db"' in content or 'prisma/dev.db' in content:
            print("   ✅ 使用 prisma/dev.db (正确)")
            correct_paths.append('executor/fix_execution_stats.py')
        else:
            print("   ⚠️  路径配置异常")
            issues.append('executor/fix_execution_stats.py: 路径配置异常')

# 4. 检查其他测试文件
print("\n4. 检查测试文件:")
test_files = [
    'executor/test_no_auth.py',
    'executor/test_example.py'
]
for test_file in test_files:
    if os.path.exists(test_file):
        with open(test_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'prisma", "prisma", "dev.db"' in content:
                print(f"   ❌ {test_file}: 使用错误的路径")
                issues.append(f'{test_file}: 使用错误的数据库路径')
            elif 'prisma", "dev.db"' in content:
                print(f"   ✅ {test_file}: 使用正确的路径")
                correct_paths.append(test_file)

# 5. 检查数据库文件是否存在
print("\n5. 检查数据库文件:")
db1 = os.path.join('prisma', 'dev.db')
db2 = os.path.join('prisma', 'prisma', 'dev.db')

if os.path.exists(db1):
    size1 = os.path.getsize(db1)
    print(f"   ✅ prisma/dev.db 存在 ({size1:,} 字节)")
else:
    print("   ❌ prisma/dev.db 不存在")
    issues.append('prisma/dev.db 文件不存在')

if os.path.exists(db2):
    size2 = os.path.getsize(db2)
    print(f"   ⚠️  prisma/prisma/dev.db 存在 ({size2:,} 字节) - 应该删除或迁移")
    issues.append('prisma/prisma/dev.db 文件存在（应该统一使用 prisma/dev.db）')
else:
    print("   ✅ prisma/prisma/dev.db 不存在（正确）")

# 总结
print("\n" + "=" * 70)
print("检查结果:")
print("=" * 70)

if issues:
    print(f"\n❌ 发现 {len(issues)} 个问题:")
    for i, issue in enumerate(issues, 1):
        print(f"   {i}. {issue}")
else:
    print("\n✅ 所有配置都正确！")

if correct_paths:
    print(f"\n✅ {len(correct_paths)} 个文件配置正确:")
    for path in correct_paths:
        print(f"   - {path}")

print("\n" + "=" * 70)
print("建议:")
print("=" * 70)
if issues:
    print("1. 修复所有错误的数据库路径配置")
    print("2. 重新生成 Prisma Client: npx prisma generate")
    print("3. 如果 prisma/prisma/dev.db 有重要数据，先迁移到 prisma/dev.db")
    print("4. 删除 prisma/prisma/dev.db 文件")
    print("5. 重启所有服务")
else:
    print("✅ 所有配置都已正确，系统统一使用 prisma/dev.db")
