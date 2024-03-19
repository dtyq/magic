#!/bin/bash
# Super Magic CLI 测试脚本

echo "================================"
echo "Super Magic CLI 功能测试"
echo "================================"
echo ""

# 测试基本命令
echo "1. 测试帮助命令..."
python bin/super-magic.py --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ 帮助命令正常"
else
    echo "   ✗ 帮助命令失败"
    exit 1
fi

# 测试 tool list
echo "2. 测试 tool list..."
python bin/super-magic.py tool list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ tool list 正常"
else
    echo "   ✗ tool list 失败"
    exit 1
fi

# 测试 tool get
echo "3. 测试 tool get..."
python bin/super-magic.py tool get create_slide --format json > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ tool get 正常"
else
    echo "   ✗ tool get 失败"
    exit 1
fi

# 测试 tool schema
echo "4. 测试 tool schema..."
python bin/super-magic.py tool schema create_slide > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ tool schema 正常"
else
    echo "   ✗ tool schema 失败"
    exit 1
fi

# 测试 skill list
echo "5. 测试 skill list..."
python bin/super-magic.py skill list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ skill list 正常"
else
    echo "   ✗ skill list 失败"
    exit 1
fi

# 测试 skill read
echo "6. 测试 skill read..."
python bin/super-magic.py skill read using-mcp > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ skill read 正常"
else
    echo "   ✗ skill read 失败"
    exit 1
fi

echo ""
echo "================================"
echo "所有测试通过！"
echo "================================"
