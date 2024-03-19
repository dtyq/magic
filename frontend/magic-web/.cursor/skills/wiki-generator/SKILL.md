---
name: wiki-generator
description: 通过分析代码结构与依赖，自动提取系统总体架构、核心特有功能模块的实现细节，并生成互相关联的多页面 Wiki 结构文档集。作为项目的架构知识库守护者，还负责在日常开发中解答疑问，并在架构变更时自动维护文档。
---

# Wiki Generator Skill

## 目标

将项目前端架构与核心业务知识沉淀为可维护的多页面 Wiki，并在回答问题或代码变更后保持文档与代码一致。

## 全局硬规则

1. 文档根目录固定为 `.cursor/skills/wiki-generator/wiki/`。
2. 所有 Wiki 页面必须可从 `wiki/_sidebar.md` 导航到。
3. 生成或更新架构/链路类文档时，必须包含至少 1 个 Mermaid 图。
4. 生成或更新任意 Markdown 时，文末必须包含 `Sources: 资料来源：`，并列出代码路径与关键行号范围。
5. 文档间链接必须使用相对路径。


## 工作流 1：梳理与初始化文档

**触发条件**
- 首次构建 Wiki 或要求全量梳理架构时。

**必做步骤**
1. 读取基础配置：`package.json`、`vite.config.ts`（或同等构建配置）。
2. 盘点核心目录与入口：如 `src/routes`、`src/pages`、`src/components`、`src/stores`。
3. 生成多页面文档并建立导航：
   - 至少包含 `wiki/README.md` 与 `wiki/_sidebar.md`
   - 高复杂模块拆分到二级目录（如 `wiki/Editor/Overview.md`）
4. 为关键架构链路补充 Mermaid 图。
5. 为每篇文档补齐 Sources。

**失败条件（FAIL）**
- 缺少 `_sidebar.md` 或存在孤立页面
- 架构文档无 Mermaid 图
- 缺少 Sources

## 工作流 2：更新文档内容

**触发条件**
- 用户要求更新指定模块文档或刷新已有 Wiki 内容。

**先判定变更类型**
- **内容变更**：仅正文、示例、说明、图表、Sources 更新；文件路径与结构不变。
- **结构变更**：新增/删除/重命名/移动文档，或新增/调整目录层级。

**必做步骤**
1. 明确范围：模块级或全量级。
2. 对照最新代码，更新对应 Markdown。
3. 若链路或状态有变化，同步更新 Mermaid。
4. 同步更新 Sources。
5. 按类型执行导航规则：
   - 内容变更：不强制更新 `_sidebar.md`
   - 结构变更：必须同步更新 `wiki/_sidebar.md` 的层级、标题与链接

**完成判定**
- 内容变更：文档内容、Mermaid（如适用）、Sources 已同步
- 结构变更：在上面基础上，`_sidebar.md` 已同步且链接可达

**失败条件（FAIL）**
- 结构变更但未更新 `_sidebar.md`
- Sources 与实际引用代码不一致

## 工作流 3：解答团队成员疑问

**触发条件**
- 团队成员询问某模块原理、链路或设计背景。

**必做步骤**
1. 先读 Wiki 对应文档，再对照最新代码。
2. 若目标模块未归档，先执行工作流 1 的局部初始化并补档。
3. 按固定结构回答：
   - 架构原理解读
   - 核心代码链路（路径 + 关键符号）
   - 注意事项/建议

## 工作流 4：架构变更后的联动更新

**触发条件**
- 当前任务修改了路由、状态管理、核心包依赖、跨模块调用关系等架构要点。

**必做步骤**
1. 判断现有 Wiki 是否因本次改动过时。
2. 若过时，立即同步更新对应文档（含 Mermaid 与 Sources）。
3. 在最终汇报中明确说明已联动更新哪些 Wiki 页面。

## 输出模板（用于工作流 1/2）

```markdown
## 本次 Wiki 变更
- 范围：
- 变更类型：内容变更 / 结构变更
- 涉及文件：

## 导航变更
- 是否更新 `_sidebar.md`：是 / 否
- 原因：

## Sources: 资料来源：
- path/to/fileA.ts (10-80)
- path/to/fileB.tsx (1-120)
```

## 本地预览

- 启动命令：`pnpm wiki`
- 脚本入口：`bash .cursor/skills/wiki-generator/scripts/serve-wiki.sh`
- 兼容说明：`.agents/skills/wiki-generator` 为软链接入口（如存在）

## Prompt 示例

- `@[wiki-generator] 更新 SuperMagic HTML 渲染链路文档，并补齐 Sources。`
- `@[wiki-generator] 新增 IframeRuntime 深入页，按二级导航挂到 SuperMagic 下。`
- `@[wiki-generator] 仅修正文档措辞，不改结构。`
