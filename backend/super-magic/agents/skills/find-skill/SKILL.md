---
name: find-skill
description: Search and install skills from the platform skill library, skill market, or skillhub. Use when the agent needs to find or install a skill to expand its capabilities. Always search the platform first; fall back to skillhub only if nothing is found.

name-cn: 检索并安装技能
description-cn: 从平台技能库、技能市场或 skillhub 检索并安装 skill。当 agent 需要查找或安装某个 skill 以扩展能力时使用。
---

<!--zh
# 检索并安装 Skills

## 查找优先级

**始终按以下顺序查找，找到后立即使用，不再往后查：**

1. **我的技能库**（已拥有，可直接使用）
2. **平台技能市场**（平台发布，可添加后安装）
3. **skillhub**（外部社区，最后兜底）
-->
# Search and Install Skills

## Search Priority

**Always search in this order and stop as soon as a match is found:**

1. **My skill library** (already owned, ready to use)
2. **Platform skill market** (published by platform, can be added then installed)
3. **skillhub** (external community, last resort fallback)

<!--zh
## platform-search — 在平台内检索技能（优先）

在「我的技能库」和「技能市场」中同时检索，返回 JSON 结果。**应先于 skillhub 执行此步骤。**

结果中：
- `my_skills`：已在你的库中
- `market`：平台市场中存在的技能
-->
## platform-search — Search Within Platform (Run First)

Searches both "my skill library" and the "platform skill market" simultaneously, returning JSON. **Always run this before trying skillhub.**

Result fields:
- `my_skills`: In your skill library
- `market`: Available in the platform skill market

```
shell_exec(
    cwd='<find-skill-absolute-path>',
    command="python scripts/search.py --keyword \"<keyword>\""
)
```

<!--zh
在 `my_skills` 中找到时，使用 `install-platform-me` 安装；在 `market` 中找到时，使用 `install-platform-market` 安装；安装完成后再用 `skills_read` 加载。参数传入搜索结果中的 `code` 字段：
-->
If found in `my_skills`, install with `install-platform-me`; if found in `market`, install with `install-platform-market`; then load with `skills_read`. Use the `code` field from search results as the argument:

```
shell_exec(
    command="skillhub install-platform-me <code>"
)
```

```
shell_exec(
    command="skillhub install-platform-market <code>"
)
```

```
skills_read(skill_names=["<skill-name>"])
```

<!--zh
## skillhub — 外部检索（兜底）

仅当平台内检索无结果时，才使用 skillhub 从外部社区检索。
-->
## skillhub — External Search (Fallback Only)

Only use skillhub if the platform search above returns no useful results.

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

