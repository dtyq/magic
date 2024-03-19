---
name: find-skill
description: Search and install skills from the internet using the skillhub CLI. Use when user wants to expand agent capabilities with third-party skills, or asks to find/install a skill from the internet.

name-cn: 从互联网检索并安装技能
description-cn: 使用 skillhub 命令行工具从互联网检索并安装 skills。当用户希望扩展 agent 能力、或要求从互联网查找/安装某个 skill 时使用。
---

<!--zh
# 使用 skillhub 检索并安装 Skills
-->
# Search and Install Skills with skillhub

<!--zh
> **重要**：所有 `skillhub` 命令调用 `shell_exec` 时，**禁止**指定 `cwd` 参数。系统会自动将执行目录固定为项目根目录，确保 skill 安装到正确位置。手动指定 `cwd` 会导致 skill 被安装到错误路径。
-->
> **Important**: Never pass the `cwd` parameter when calling `shell_exec` for any `skillhub` command. The system automatically uses the project root as the working directory to ensure skills are installed to the correct location. Specifying `cwd` manually will cause skills to be installed to the wrong path.

<!--zh
## search — 搜索技能

关键词自然语言搜索，默认返回 20 条结果。
-->
## search — Search for Skills

Keyword / natural language search, returns up to 20 results by default.

```
shell_exec(
    command="skillhub search \"react best practices\""
)
```

<!--zh
## install — 安装技能

`slug` 来自 `search` 结果的 `slug` 字段。安装完成后，使用 `skills_read` 工具加载技能内容，参数为 SKILL.md 中的 `name` 字段值。
-->
## install — Install a Skill

The `slug` comes from the `slug` field in `search` results. After installation, use `skills_read` to load the skill — the parameter is the `name` field value in the skill's SKILL.md.

```
shell_exec(
    command="skillhub install <slug>"
)
```

```
skills_read(skill_names=["<skill-name>"])
```

<!--zh
## upgrade — 升级已安装的技能

升级所有已安装的技能到最新版本。
-->
## upgrade — Upgrade Installed Skills

Upgrade all installed skills to their latest versions.

```
shell_exec(
    command="skillhub upgrade"
)
```

<!--zh
升级指定技能：
-->
Upgrade a specific skill:

```
shell_exec(
    command="skillhub upgrade <slug>"
)
```

<!--zh
## list — 查看已安装的技能

列出当前已安装的所有技能及其版本号。
-->
## list — List Installed Skills

List all currently installed skills and their versions.

```
shell_exec(
    command="skillhub list"
)
```

<!--zh
## install-github — 从 GitHub 安装技能

支持整个仓库或仓库内子目录。安装完成后同样使用 `skills_read` 加载。
-->
## install-github — Install a Skill from GitHub

Supports a full repository or a subdirectory inside a repository. After installation, use `skills_read` to load it.

Install from a full repository:

```
shell_exec(
    command="skillhub install-github https://github.com/<owner>/<repo>"
)
```

Install from a subdirectory:

```
shell_exec(
    command="skillhub install-github https://github.com/<owner>/<repo>/tree/<branch>/<path/to/skill>"
)
```

```
skills_read(skill_names=["<skill-name>"])
```

<!--zh
## remove — 移除已安装的技能
-->
## remove — Remove an Installed Skill

```
shell_exec(
    command="skillhub remove <skill-name>"
)
```

