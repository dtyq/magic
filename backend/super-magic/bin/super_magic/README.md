# Super Magic CLI

Super Magic CLI 是一个强大的命令行工具，用于查询和管理项目中的工具（tools）和技能（skills）。

## 功能特性

### Tool 管理
- 列出所有可用工具
- 搜索工具
- 获取工具详细信息
- 查看工具参数 schema

### Skill 管理
- 列出所有可用 skills
- 读取 skill 完整内容
- 读取 skill reference 文档
- 搜索 skills

## 安装依赖

```bash
pip install click rich pyyaml
```

或者安装完整项目依赖：

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本命令

```bash
# 显示帮助信息
python bin/super-magic.py --help

# 显示版本信息
python bin/super-magic.py --version
```

### Tool 命令

#### 列出所有工具

```bash
# JSON 格式（默认，适合大模型读取）
python bin/super-magic.py tool list

# CSV 格式（紧凑）
python bin/super-magic.py tool list --format csv

# 表格格式（适合人类阅读）
python bin/super-magic.py tool list --format table
```

#### 获取工具详情

```bash
# 获取单个工具
python bin/super-magic.py tool get create_slide

# 批量获取多个工具
python bin/super-magic.py tool get create_slide,analysis_slide_webpage
```

#### 获取工具 Schema

```bash
# 获取单个工具的参数 schema
python bin/super-magic.py tool schema create_slide

# 批量获取多个工具的 schema
python bin/super-magic.py tool schema create_slide,analysis_slide_webpage
```

### Skill 命令

#### 列出所有 Skills

```bash
# JSON 格式（默认，适合大模型读取）
python bin/super-magic.py skill list

# CSV 格式（紧凑）
python bin/super-magic.py skill list --format csv

# 表格格式（适合人类阅读）
python bin/super-magic.py skill list --format table

# 显示所有 skills（包括未启用的）
python bin/super-magic.py skill list --all
```

#### 读取 Skill 内容

```bash
# 读取单个 skill
python bin/super-magic.py skill read creating-slides

# 批量读取多个 skills
python bin/super-magic.py skill read creating-slides,canvas-designer

# JSON 格式输出
python bin/super-magic.py skill read using-mcp --format json
```

#### 读取 Skill Reference 文档

```bash
# 读取单个 reference 文档
python bin/super-magic.py skill references canvas-designer image-generation.md

# 批量读取多个 reference 文档
python bin/super-magic.py skill references canvas-designer image-generation.md,image-search.md
```

## 输出格式

### JSON 格式（默认）
结构化的 JSON 输出，最适合大模型读取和程序解析。

**特点：**
- 结构化清晰
- 包含完整元数据
- 支持复杂嵌套结构
- 大模型理解能力强

### CSV 格式
紧凑的 CSV 输出，节省 token。

**特点：**
- 更紧凑，省 token（比 JSON 节省约 10%）
- 适合列表数据
- 扫描速度快

### 表格格式
使用 Rich 库提供美化的表格输出，适合人类阅读。

**特点：**
- 可视化友好
- 彩色输出
- 适合终端查看

## 快捷使用示例

```bash
# 查看 create_slide 工具的完整信息
python bin/super-magic.py tool get create_slide

# 读取 creating-slides skill 的完整文档
python bin/super-magic.py skill read creating-slides

# 查看 using-mcp skill 的 reference 文档
python bin/super-magic.py skill references using-mcp workflow.md
```

## 项目结构

```
bin/
├── super-magic.py              # 主入口文件
└── super_magic/                # CLI 包
    ├── __init__.py
    ├── cli.py                  # Click 命令定义
    ├── utils.py                # 工具函数
    └── commands/
        ├── __init__.py
        ├── tool.py             # tool 子命令
        └── skill.py            # skill 子命令
```

## 技术栈

- **Click**: CLI 框架
- **Rich**: 终端美化和表格输出
- **agentlang.skills**: Skill 管理器

## 特点

- **零依赖项目上下文**: 直接使用 agentlang.skills.SkillManager，无需初始化完整项目
- **快速响应**: 启动时间 < 0.2 秒
- **大模型友好**: 默认 JSON 格式，结构清晰易于理解
- **灵活格式**: 支持 json、csv、table 三种输出格式
- **批量操作**: 支持批量查询工具和 skills
- **美观输出**: 使用 Rich 库提供彩色表格输出

## 开发说明

### 添加新的子命令

1. 在 `bin/super_magic/commands/` 目录创建新的命令文件
2. 使用 `@click.group()` 定义命令组
3. 在 `bin/super_magic/cli.py` 中注册命令

### 测试

```bash
# 运行所有测试
pytest

# 测试特定功能
python bin/super-magic.py tool list
python bin/super-magic.py skill list
```

## 许可证

与主项目保持一致。
