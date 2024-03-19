# Crew 模块 — 后端接口 & 数据模型清单

> 基于 CrewMarket / CrewCreate / MyCrewPage / MySkillsPage 四个模块的前端业务逻辑与 Store 分析整理。  
> 当前前端全部使用 Mock 数据，所有接口均为待实现状态（`// TODO`）。  
> 生成时间：2026-02-28

---

## 目录

1. [后端接口列表](#一后端接口列表)
   - [1.1 员工市场（Crew Market）](#11-员工市场crew-market)
   - [1.2 技能库（Skills Library）](#12-技能库skills-library)
   - [1.3 我的员工（My Crew）](#13-我的员工my-crew)
   - [1.4 我的技能（My Skills）](#14-我的技能my-skills)
   - [1.5 创建/编辑员工（Crew Create / Edit）](#15-创建编辑员工crew-create--edit)
   - [1.6 剧本 & 场景（Playbook / Scenes）](#16-剧本--场景playbook--scenes)
   - [1.7 知识库（Knowledge Base）](#17-知识库knowledge-base)
   - [1.8 发布（Publishing）](#18-发布publishing)
2. [数据模型清单](#二数据模型清单)
   - [2.1 通用基础类型](#21-通用基础类型)
   - [2.2 员工/Crew 相关模型](#22-员工crew-相关模型)
   - [2.3 技能相关模型](#23-技能相关模型)
   - [2.4 场景/剧本相关模型](#24-场景剧本相关模型)
   - [2.5 面板配置相关模型](#25-面板配置相关模型)
   - [2.6 接口通用响应模型](#26-接口通用响应模型)

---

## 一、后端接口列表

### 1.1 员工市场（Crew Market）

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `GET` | `/api/crew/market` | 获取员工市场列表（支持分页、分类筛选、关键词搜索） | `CrewMarketPage.handleSearch` / 列表渲染 |
| 2 | `GET` | `/api/crew/market/categories` | 获取员工分类标签列表 | `CategoryFilter` 组件 |
| 3 | `GET` | `/api/crew/market/:crewId` | 获取员工市场详情 | `handleDetails` TODO |
| 4 | `POST` | `/api/crew/hire` | 雇用一名市场员工（加入我的员工） | `handleHire` |
| 5 | `DELETE` | `/api/crew/hire/:crewId` | 解雇/移除已雇用员工 | `handleDismiss` |

**Query Params（列表接口）：**

```
GET /api/crew/market?keyword=&category=all&page=1&page_size=20
```

---

### 1.2 技能库（Skills Library）

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `GET` | `/api/skills/library` | 获取技能库列表（支持分页、关键词搜索、作者类型筛选） | `SkillsLibrary.handleSearch` / 列表渲染 |
| 2 | `POST` | `/api/skills/my-skills` | 将技能添加到我的技能库 | `handleAdd` |
| 3 | `DELETE` | `/api/skills/my-skills/:skillId` | 从我的技能库中移除技能 | `handleRemove` |
| 4 | `POST` | `/api/skills/create-via-chat` | 通过对话创建技能（跳转至对话创建流程） | `handleCreateViaChat` TODO |
| 5 | `POST` | `/api/skills/import` | 导入技能（文件上传） | `handleImportSkill` TODO |
| 6 | `POST` | `/api/skills/import/github` | 从 GitHub 仓库导入技能 | `handleImportFromGithub` TODO |

**Query Params（列表接口）：**

```
GET /api/skills/library?keyword=&author_type=&page=1&page_size=20
```

---

### 1.3 我的员工（My Crew）

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `GET` | `/api/crew/my-crew` | 获取当前用户的员工列表 | `MyCrewPage` 列表渲染 |
| 2 | `DELETE` | `/api/crew/my-crew/:crewId` | 解雇/删除我的员工 | `handleDismiss` |
| 3 | `GET` | `/api/crew/my-crew/:crewId` | 获取我的员工详情（编辑前加载） | `handleEdit` TODO |

---

### 1.4 我的技能（My Skills）

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `GET` | `/api/skills/my-skills` | 获取当前用户的技能列表 | `MySkillsPage` 列表渲染 |
| 2 | `DELETE` | `/api/skills/my-skills/:skillId` | 删除我的技能 | `handleDelete` |
| 3 | `GET` | `/api/skills/my-skills/:skillId` | 获取技能详情（编辑前加载） | `handleEdit` TODO |
| 4 | `POST` | `/api/skills` | 创建新技能 | `handleCreateViaChat` TODO |
| 5 | `PUT` | `/api/skills/:skillId` | 更新技能基本信息 | 技能编辑页（待实现） |

---

### 1.5 创建/编辑员工（Crew Create / Edit）

对应 `CrewCreate` 模块的 6 个步骤：Identity / KnowledgeBase / Skills / RunAndDebug / Publishing / Playbook。

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `POST` | `/api/crew` | 创建新员工（保存基本信息草稿） | `CrewCreateStore` — 目前仅 localStorage 持久化 |
| 2 | `GET` | `/api/crew/:crewId` | 获取员工完整配置（编辑模式加载） | 编辑入口 TODO |
| 3 | `PUT` | `/api/crew/:crewId` | 更新员工基本信息（名称、角色、描述、Prompt、头像等） | `BasicInfoPanel.handleSave` TODO |
| 4 | `PUT` | `/api/crew/:crewId/skills` | 更新员工绑定的技能列表 | `addSkill` / `removeSkill` actions TODO |

**请求体（创建/更新员工）：**

```json
{
  "name": "string",
  "role": "string",
  "description": "string",
  "prompt": "string",
  "avatar_url": "string",
  "skills": [{ "id": "string", "name": "string" }]
}
```

---

### 1.6 剧本 & 场景（Playbook / Scenes）

对应 `CrewCreate` 的 Playbook 步骤，管理员工的场景配置。

| # | 方法 | 路径 | 描述 | 来源 |
|---|------|------|------|------|
| 1 | `GET` | `/api/crew/:crewId/scenes` | 获取员工的场景列表 | `CrewCreateStore.fetchScenes()` TODO |
| 2 | `POST` | `/api/crew/:crewId/scenes` | 创建新场景 | 场景编辑面板 TODO |
| 3 | `PUT` | `/api/crew/:crewId/scenes/:sceneId` | 更新场景配置（基本信息 + 面板配置） | `SceneEditStore` actions TODO |
| 4 | `DELETE` | `/api/crew/:crewId/scenes/:sceneId` | 删除场景 | `deleteScene()` TODO |
| 5 | `PATCH` | `/api/crew/:crewId/scenes/:sceneId/enabled` | 切换场景启用/禁用状态 | `toggleSceneEnabled()` TODO |
| 6 | `PUT` | `/api/crew/:crewId/scenes/reorder` | 批量重排序场景列表 | `reorderScenes()` TODO |

**场景更新请求体：**

```json
{
  "name": { "zh_CN": "string", "en_US": "string" },
  "description": { "zh_CN": "string", "en_US": "string" },
  "icon": "string",
  "enabled": true,
  "configs": {
    "presets": { /* FieldPanelConfig */ },
    "quick_start": { /* GuidePanelConfig */ },
    "inspiration": { /* DemoPanelConfig */ }
  }
}
```

**场景重排序请求体：**

```json
{
  "ordered_ids": ["sceneId1", "sceneId2", "sceneId3"]
}
```

---

### 1.7 知识库（Knowledge Base）

对应 CrewCreate 的 KnowledgeBase 步骤（UI 已有步骤入口，具体功能待实现）。

| # | 方法 | 路径 | 描述 |
|---|------|------|------|
| 1 | `GET` | `/api/crew/:crewId/knowledge-base` | 获取员工关联的知识库列表 |
| 2 | `POST` | `/api/crew/:crewId/knowledge-base` | 为员工关联知识库 |
| 3 | `DELETE` | `/api/crew/:crewId/knowledge-base/:kbId` | 移除员工的知识库关联 |

---

### 1.8 发布（Publishing）

对应 CrewCreate 的 Publishing 步骤（UI 已有步骤入口，具体功能待实现）。

| # | 方法 | 路径 | 描述 |
|---|------|------|------|
| 1 | `POST` | `/api/crew/:crewId/publish` | 发布员工（使其在市场可见） |
| 2 | `PUT` | `/api/crew/:crewId/publish` | 更新发布配置（可见范围、版本等） |
| 3 | `DELETE` | `/api/crew/:crewId/publish` | 下架员工（取消发布） |

---

## 二、数据模型清单

### 2.1 通用基础类型

```typescript
/**
 * Multi-language text field.
 * Can be a plain string (single lang) or a locale map.
 * e.g. { "zh_CN": "风格", "en_US": "Style" }
 */
type LocaleText = string | Record<string, string>

/** Panel display view type */
const enum OptionViewType {
  GRID = "grid",
  WATERFALL = "waterfall",
  TEXT_LIST = "text_list",
  CAPSULE = "capsule",
}

/** Panel type discriminant */
const enum SkillPanelType {
  GUIDE = "guide",
  FIELD = "field",
  DEMO = "demo",
}

/** Click action types for guide items */
type ClickActionType =
  | "no_action"
  | "focus_input"
  | "ai_enhancement"
  | "fill_content"
  | "open_url"
  | "upload_file"

/** Execution method when click action fills/sends content */
type ExecutionMethodType = "send_immediately" | "insert_to_input"
```

---

### 2.2 员工/Crew 相关模型

```typescript
/** Hire status of a crew in the market */
type HireStatus = "hired" | "not-hired" | "hover"

/** Crew item returned by the market list API */
interface CrewDTO {
  id: string
  name: string
  description: string
  /** Capability feature tags */
  features: string[]
  /** Avatar image URL */
  avatar?: string
  /** Whether the current user has hired this crew */
  hire_status: HireStatus
  /** Category IDs this crew belongs to */
  category_ids?: string[]
  /** ISO date string */
  created_at: string
  updated_at: string
}

/** Crew category filter item */
interface CrewCategory {
  id: string
  /** Display name (localized) */
  name: LocaleText
  /** Lucide icon name */
  icon: string
}

/** Crew member configuration (used in CrewCreate) */
interface CrewMemberData {
  name: string
  role: string
  skills: CrewSkill[]
  description: string
  /** System prompt */
  prompt: string
  avatar_url: string
  /** Playbook scenes configured for this member */
  scenes: SceneItem[]
}

/** Skill bound to a crew member */
interface CrewSkill {
  id: string
  name: string
}

/** Full crew entity (create/edit payload and detail response) */
interface CrewEntity {
  id?: string
  crew_name: string
  topic_name: string
  member: CrewMemberData
  publish_status?: "draft" | "published" | "unpublished"
  created_at?: string
  updated_at?: string
}

/** Draft stored in localStorage */
interface CrewCreateDraft {
  crew_name: string
  topic_name: string
  member: CrewMemberData
}
```

---

### 2.3 技能相关模型

```typescript
/** Author type for a skill */
type SkillAuthorType = "official" | "user"

/** Add status of a skill in the library */
type SkillStatus = "added" | "not-added"

/** Skill install status (used in CrewCreate skills step) */
type SkillInstallStatus = "not-installed" | "added" | "installed"

/** Skill item returned by library / my-skills list API */
interface SkillDTO {
  id: string
  name: string
  description: string
  /** Thumbnail image URL */
  thumbnail?: string
  /** Whether the current user has added this skill */
  status: SkillStatus
  /** Author type */
  author_type: SkillAuthorType
  /** Author display name (when author_type = "user") */
  author_name?: string
  /** ISO date string, display as "Updated on Feb 5, 2026" */
  updated_at: string
  /** Number of users using this skill */
  users_count?: number
}

/** Skill configuration (panel configs for interaction) */
interface SkillConfig {
  panels: SkillPanelConfig[]
  placeholder?: LocaleText
}
```

---

### 2.4 场景/剧本相关模型

```typescript
/** Context menu actions available on a scene row */
type SceneAction = "edit" | "delete"

/** A single scene/playbook item */
interface SceneItem {
  id: string
  name: LocaleText
  description: LocaleText
  /** Lucide icon name (kebab-case or PascalCase) */
  icon: string
  enabled: boolean
  /** ISO date string */
  update_at: string
  /** Per-tab panel configurations */
  configs?: {
    presets?: FieldPanelConfig
    quick_start?: GuidePanelConfig
    inspiration?: DemoPanelConfig
  }
}

/** Reorder request payload */
interface SceneReorderPayload {
  ordered_ids: string[]
}

/** Toggle enabled request payload */
interface SceneTogglePayload {
  enabled: boolean
}
```

---

### 2.5 面板配置相关模型

这些类型用于场景编辑器的三个面板（Presets / Quick Start / Inspiration）。

```typescript
/** Base panel configuration (shared by all panel types) */
interface BasePanelConfig {
  title?: LocaleText
  /** Whether this panel is visible to end-users */
  enabled?: boolean
  expandable?: boolean
  default_expanded?: boolean
}

// ── Presets Panel (FieldPanel) ────────────────────────────────────────────

/** A single preset filter/field item */
interface FieldItem {
  data_key: string
  label: LocaleText
  current_value: string
  options: (OptionGroup | OptionItem)[]
  has_leading_icon?: boolean
  leading_icon?: string
  default_group_key?: string
  default_value?: string
  option_view_type?: OptionViewType
  enabled?: boolean
  updated_at?: string
  /** Instruction appended to user messages via preset value */
  preset_content?: string
}

/** A template/option card */
interface OptionItem {
  value: string
  label?: LocaleText
  thumbnail_url?: string
  description?: LocaleText
  icon_url?: string
  sub_text?: LocaleText
  width?: number
  height?: number
  aspect_ratio?: number
}

/** A group of template options */
interface OptionGroup {
  group_key: string
  group_name: LocaleText
  group_icon?: string
  group_description?: LocaleText
  children?: OptionItem[]
}

/** Presets panel configuration */
interface FieldPanelConfig extends BasePanelConfig {
  type: SkillPanelType.FIELD
  field?: {
    items: FieldItem[]
    view_type?: string
  }
}

// ── Quick Start Panel (GuidePanel) ───────────────────────────────────────

/** A single quick-start guide item */
interface GuideItem {
  key: string
  title: LocaleText
  description: LocaleText
  icon: string
  enabled?: boolean
  updated_at?: string
  click_action?: ClickActionType
  preset_content?: string
  url?: string
  execution_method?: ExecutionMethodType
}

/** Quick Start panel configuration */
interface GuidePanelConfig extends BasePanelConfig {
  type: SkillPanelType.GUIDE
  guide: {
    items: GuideItem[]
  }
}

// ── Inspiration Panel (DemoPanel) ────────────────────────────────────────

/** Inspiration / demo panel configuration */
interface DemoPanelConfig extends BasePanelConfig {
  type: SkillPanelType.DEMO
  demo: {
    groups: OptionGroup[]
    default_selected_group_key?: string
    default_selected_template_key?: string
    view_type?: OptionViewType
  }
}

/** Union type for all panel configs */
type SkillPanelConfig = FieldPanelConfig | GuidePanelConfig | DemoPanelConfig

type SkillPanelConfigArray = SkillPanelConfig[]
```

---

### 2.6 接口通用响应模型

```typescript
/** Standard paginated list response */
interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/** Standard API response wrapper */
interface ApiResponse<T = void> {
  code: number
  message: string
  data: T
}

/** Standard list query parameters */
interface ListQueryParams {
  page?: number
  page_size?: number
  keyword?: string
}

/** Crew market list query parameters */
interface CrewMarketQueryParams extends ListQueryParams {
  category?: string
}

/** Skills library list query parameters */
interface SkillsLibraryQueryParams extends ListQueryParams {
  /** Filter by author type */
  author_type?: SkillAuthorType | ""
}
```

---

## 附录：CrewCreate 工作流步骤枚举

```typescript
const CREW_CREATE_STEP = {
  Identity: "identity",           // 身份配置（名称/角色/头像/描述/Prompt）
  KnowledgeBase: "knowledge-base", // 知识库绑定
  Skills: "skills",               // 技能绑定
  RunAndDebug: "run-and-debug",   // 运行调试
  Publishing: "publishing",       // 发布设置
  Playbook: "playbook",           // 剧本/场景配置
} as const

type CrewCreateStep = typeof CREW_CREATE_STEP[keyof typeof CREW_CREATE_STEP]
```

---

## 优先级建议

| 优先级 | 接口模块 | 说明 |
|--------|----------|------|
| P0 | 员工市场列表 & 技能库列表 | 核心入口，直接影响 CrewMarket 页面展示 |
| P0 | 我的员工列表 & 我的技能列表 | MyCrewPage / MySkillsPage 的核心数据 |
| P1 | 雇用/解雇员工 & 添加/移除技能 | 核心交互操作 |
| P1 | 场景列表获取 | `CrewCreateStore.fetchScenes()` 最高优先 TODO |
| P2 | 创建/更新员工 (Crew Create) | 替换 localStorage 草稿为服务端持久化 |
| P2 | 场景 CRUD & 重排序 | PlaybookPanel 全部操作持久化 |
| P3 | 技能创建 (via chat / import / github) | 需要独立创建流程 |
| P3 | 知识库 & 发布 | CrewCreate 的后两个步骤 |
