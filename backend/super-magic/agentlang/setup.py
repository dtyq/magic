#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
from setuptools import setup, find_packages

# 读取 README.md 文件
with open(os.path.join(os.path.dirname(__file__), "README.md"), "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="agentlang",
    version="0.1.3",
    author="SuperMagic Team",
    author_email="dev@magicrew.ai",
    description="简单、高效的 AI 代理框架",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/dtyq/agentlang",
    package_dir={"": "."},
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[
        "pydantic>=2.0.0",
        "tiktoken>=0.5.0",
        "aiofiles>=0.8.0",
        "openai>=1.0.0",
        "PyYAML>=6.0",
        "html5lib>=1.1",
        "tinycss2>=1.2.1",
        "beautifulsoup4>=4.11.1",
        "loguru>=0.7.0",
        "asyncio>=3.4.3",
        "pytest-asyncio>=0.21.0",
    ],
    keywords="agent, llm, ai, framework",
    project_urls={
        "Bug Reports": "https://github.com/dtyq/agentlang/issues",
        "Source": "https://github.com/dtyq/agentlang",
    },
    include_package_data=True,  # 包含 MANIFEST.in 中指定的数据文件
)
