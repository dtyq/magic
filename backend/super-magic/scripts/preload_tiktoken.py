#!/usr/bin/env python3
import os
import tiktoken

# 打印缓存目录路径
cache_dir = os.environ.get("TIKTOKEN_CACHE_DIR")
if not cache_dir:
    raise ValueError("TIKTOKEN_CACHE_DIR 环境变量未设置")

print(f'使用 tiktoken 缓存目录: {cache_dir}')

# 预加载 cl100k_base 编码器
encoding = tiktoken.get_encoding('cl100k_base')

# 测试编码器是否正常工作
test_string = "测试中文和English"
tokens = encoding.encode(test_string)
token_count = len(tokens)

print(f'Tiktoken cl100k_base 编码器预加载成功，测试字符串包含 {token_count} 个tokens')
print(f'测试字符串: "{test_string}"')
print(f'对应的tokens: {tokens}') 