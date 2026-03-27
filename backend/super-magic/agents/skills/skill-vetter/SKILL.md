---
name: skill-vetter
description: Security-first skill vetting protocol for AI agents. Use before installing any skill from the platform skill market, skillhub, GitHub, or other sources. Checks for red flags, permission scope, and suspicious patterns to determine whether a skill is safe to install.

name-cn: 技能安全审查
description-cn: 安装任何来源的技能前必须执行的安全审查协议。检查危险信号、权限范围和可疑模式，判断技能是否安全可安装。
---

<!--zh
# 技能安全审查（Skill Vetter）

安装任何技能之前，必须先执行此审查流程。
-->
# Skill Vetter

Security-first vetting protocol for AI agent skills. **Never install a skill without vetting it first.**

<!--zh
## 何时使用

- 从平台技能市场添加技能之前
- 从 skillhub 安装外部技能之前
- 从 GitHub 仓库安装技能之前
- 评估其他 Agent 分享的技能时
- 任何被要求安装来路不明的代码时
-->
## When to Use

- Before installing any skill from the platform skill market
- Before installing external skills from skillhub
- Before running skills from GitHub repositories
- When evaluating skills shared by other agents
- Anytime you are asked to install unknown code

---

<!--zh
## 审查协议

### 第一步：来源核查
-->
## Vetting Protocol

### Step 1: Source Check

<!--zh
需要确认的问题：
- 技能来自哪里？（平台市场 / skillhub / GitHub / 其他）
- 作者是否已知、可信？
- 下载量 / Star 数量如何？
- 最近更新时间？
- 是否有其他 Agent 的使用评价？
-->
Questions to answer:
- Where did this skill come from? (platform market / skillhub / GitHub / other)
- Is the author known or reputable?
- How many downloads or stars does it have?
- When was it last updated?
- Are there reviews from other agents?

<!--zh
### 第二步：预览安装到临时目录，读取所有文件

**不要先正式安装，先安装到临时目录进行审查。**

根据来源选择对应的预览方式：

**skillhub 来源**（支持 `--dir` 指定临时目录）：
-->
### Step 2: Preview Install to Temp Dir, Then Read All Files

**Do not install to the real skills directory yet. Install to a temp directory first for inspection.**

Choose the preview method based on the source:

<!--zh
**skillhub 来源**（支持 `--dir` 指定临时目录）：
-->
**skillhub source** (supports `--dir` for temp directory):

```bash
skillhub --dir /tmp/skillhub-preview/ install <slug>
```

<!--zh
安装完成后，用 `shell_exec` 列出并逐一读取所有文件内容：
-->
After install, use `shell_exec` to list and read all files:

```bash
# 列出所有文件
shell_exec(command="find /tmp/skillhub-preview/<skill-name> -type f | sort")

# 逐一读取（对每个文件执行）
shell_exec(command="cat /tmp/skillhub-preview/<skill-name>/SKILL.md")
shell_exec(command="cat /tmp/skillhub-preview/<skill-name>/scripts/<file>.py")
# ... 依次读取所有脚本、配置、引用文件
```

<!--zh
审查通过后，执行不带 `--dir` 的正式安装命令；无论结果如何，清理临时目录：
-->
If approved, run the normal install without `--dir`. Either way, clean up the temp dir:

```bash
shell_exec(command="rm -rf /tmp/skillhub-preview/")
```

<!--zh
**平台技能市场 / 我的技能库来源**（同样支持 `--dir` 安装到临时目录）：
-->
**Platform market / my skill library source** (also supports `--dir` for temp directory):

```bash
shell_exec(command="skillhub install-platform-me <code> --dir /tmp/skillhub-preview/")
# or
shell_exec(command="skillhub install-platform-market <code> --dir /tmp/skillhub-preview/")
```

<!--zh
安装后用 `shell_exec` 列出并逐一读取所有文件内容：
-->
After install, use `shell_exec` to list and read all files:

```bash
# 列出所有文件
shell_exec(command="find /tmp/skillhub-preview/<skill-name> -type f | sort")

# 逐一读取
shell_exec(command="cat /tmp/skillhub-preview/<skill-name>/SKILL.md")
shell_exec(command="cat /tmp/skillhub-preview/<skill-name>/scripts/<file>.py")
# ... 依次读取所有文件
```

<!--zh
审查通过后，执行不带 `--dir` 的正式安装命令；无论结果如何，清理临时目录：
-->
If approved, run the normal install without `--dir`. Either way, clean up the temp dir:

```bash
shell_exec(command="rm -rf /tmp/skillhub-preview/")
```

<!--zh
### 第三步：代码审查（必须执行）

阅读技能目录下的**所有文件**。遇到以下任何情况，立即拒绝安装：
-->
### Step 3: Code Review (MANDATORY)

Read ALL files in the skill. Reject immediately if any of the following are present:

```
REJECT IMMEDIATELY IF YOU SEE:
─────────────────────────────────────────
- curl/wget to unknown URLs
- Sends data to external servers
- Requests credentials, tokens, or API keys
- Reads ~/.ssh, ~/.aws, ~/.config without clear reason
- Accesses MEMORY.md, USER.md, SOUL.md, IDENTITY.md
- Uses base64 decode on anything
- Uses eval() or exec() with external input
- Modifies system files outside the workspace
- Installs packages without listing them explicitly
- Network calls to raw IP addresses instead of domains
- Obfuscated code (compressed, encoded, or minified)
- Requests elevated or sudo permissions
- Accesses browser cookies or sessions
- Touches credential files
─────────────────────────────────────────
```

<!--zh
### 第四步：权限范围评估
-->
### Step 4: Permission Scope

<!--zh
评估以下维度：
- 需要读取哪些文件？
- 需要写入哪些文件？
- 会执行哪些命令？
- 是否需要网络访问？访问哪里？
- 权限范围是否与其声明的用途相匹配（最小必要原则）？
-->
Evaluate:
- What files does it need to read?
- What files does it need to write?
- What commands does it run?
- Does it need network access? To where?
- Is the scope minimal for its stated purpose?

<!--zh
### 第五步：风险分级
-->
### Step 5: Risk Classification

<!--zh
| 风险级别 | 示例 | 处置方式 |
|---------|------|---------|
| LOW（低） | 笔记、天气、格式化 | 基础审查后可安装 |
| MEDIUM（中） | 文件操作、浏览器、外部 API | 必须完整代码审查 |
| HIGH（高） | 凭证操作、交易、系统命令 | 需要用户人工审批 |
| EXTREME（极高） | 安全配置、root 权限 | 禁止安装 |
-->

| Risk Level | Examples | Action |
|------------|----------|--------|
| LOW | Notes, weather, formatting | Basic review, install OK |
| MEDIUM | File ops, browser, external APIs | Full code review required |
| HIGH | Credentials, trading, system commands | Human approval required |
| EXTREME | Security configs, root access | Do NOT install |

---

<!--zh
## 审查报告格式

审查完成后，输出以下格式的报告：
-->
## Output Format

After vetting, produce this report:

```
SKILL VETTING REPORT
=======================================
Skill: [name]
Source: [platform market / skillhub / GitHub / other]
Author: [username]
Version: [version]
---------------------------------------
METRICS:
- Downloads/Stars: [count]
- Last Updated: [date]
- Files Reviewed: [count]
---------------------------------------
RED FLAGS: [None / list them]

PERMISSIONS NEEDED:
- Files: [list or "None"]
- Network: [list or "None"]
- Commands: [list or "None"]
---------------------------------------
RISK LEVEL: [LOW / MEDIUM / HIGH / EXTREME]

VERDICT: [SAFE TO INSTALL / INSTALL WITH CAUTION / DO NOT INSTALL]

NOTES: [Any observations]
=======================================
```

---

<!--zh
## 信任层级

1. **平台官方技能**（平台市场发布）→ 较低审查强度（仍需审查）
2. **高 Star 仓库（1000+）** → 中等审查强度
3. **已知作者** → 中等审查强度
4. **新的 / 未知来源** → 最高审查强度
5. **申请凭证的技能** → 必须经过用户人工审批
-->
## Trust Hierarchy

1. **Official platform skills** (published via platform market) — lower scrutiny (still review)
2. **High-star repos (1000+)** — moderate scrutiny
3. **Known authors** — moderate scrutiny
4. **New or unknown sources** — maximum scrutiny
5. **Skills requesting credentials** — human approval always required

---

<!--zh
## 基本原则

- 没有任何技能值得为此牺牲安全性
- 有疑问时，不要安装
- 高风险决策交给用户来做
- 记录你审查过的内容，供后续参考
-->
## Principles

- No skill is worth compromising security
- When in doubt, do not install
- Escalate high-risk decisions to the user
- Document what you vet for future reference
