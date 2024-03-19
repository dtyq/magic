# Super Magic Workspace 组件测试 ID 汇总

本文档汇总了 Super Magic Workspace 相关组件中添加的所有测试 ID（data-testid），用于自动化测试。

> **重要提示**: 所有 `data-testid` 仅添加在**原生 HTML 元素**上（如 div、span、button 等），不添加在 React 组件上。

## 相关文档

- **[编辑器组件测试 ID](./test-ids-editors.md)** - 三个编辑器组件的详细测试 ID（ChatMessageEditor、RecordSummaryEditorPanel、MessageEditor）

## 目录

- [MainWorkspaceContent 组件](#mainworkspacecontent-组件)
- [MessageHeader 组件](#messageheader-组件)
- [MessagePanel 组件](#messagepanel-组件)
- [ProjectItem 组件](#projectitem-组件)
- [测试场景示例](#测试场景示例)
- [安全审查报告](#安全审查报告)

---

## MainWorkspaceContent 组件

### 主容器和布局

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `main-workspace-container` | div | 工作区主容器 | 始终显示 | - |
| `workspace-sidebar-wrapper` | div | 侧边栏包装容器 | 始终显示 | - |
| `detail-panel-wrapper` | div | 详情面板外层包装 | workspacePage !== Home | `data-detail-mode`: single/files |
| `message-panel-wrapper` | div | 消息面板包装容器 | 始终显示 | `data-workspace-page`: Home/Chat/AllProjects |

### 组件层级结构

```
main-workspace-container
├── workspace-sidebar-wrapper
│   └── detail-panel-wrapper [data-detail-mode]
└── message-panel-wrapper [data-workspace-page]
    ├── MessageHeader (内部有详细 test-id)
    ├── EmptyWorkspacePanel (workspacePage === Home)
    └── MessageList + MessagePanel (workspacePage === Chat)
```

---

## MessageHeader 组件

MessageHeader 组件负责显示话题标题、状态和操作按钮。

### 主要元素

| Test ID | 元素类型 | 描述 | 显示条件 | 交互功能 |
|---------|---------|------|----------|----------|
| `message-header-container` | div | MessageHeader 主容器 | 始终显示 | - |
| `message-header-topic-section` | div | 话题信息区域 | 始终显示 | 包含状态图标和话题名称 |
| `message-header-topic-name` | span | 话题名称（可点击重命名） | 非重命名状态 | 点击进入重命名模式 |
| `message-header-rename-input` | Input | 话题重命名输入框 | 重命名状态 | 输入新名称，回车/失焦保存 |
| `message-header-action-buttons` | div | 操作按钮组容器 | 始终显示 | - |

### 操作按钮

| Test ID | 元素类型 | 描述 | 交互功能 |
|---------|---------|------|----------|
| `message-header-topic-group` | div | 话题组（新建+历史） | 包含新建话题和历史按钮 |
| `message-header-new-topic-button` | div | 新建话题按钮 | 创建新的对话话题 |
| `message-header-history-button` | div | 历史话题按钮 | 打开历史话题下拉面板 |
| `message-header-share-button` | div | 分享按钮 | 分享当前话题 |

**状态属性**:
- `message-header-share-button` 包含 `data-disabled={boolean}` 标识是否可分享

### 历史话题面板

| Test ID | 元素类型 | 描述 | 显示条件 |
|---------|---------|------|----------|
| `message-header-history-panel` | div | 历史话题面板容器 | 点击历史按钮后 |
| `message-header-history-header` | div | 历史面板头部 | 始终显示 |
| `message-header-history-search-input` | Input | 搜索历史话题输入框 | 始终显示 |
| `message-header-history-list` | div | 历史话题列表容器 | 始终显示 |
| `message-header-history-empty` | div | 无匹配话题提示 | 搜索无结果时 |
| `message-header-history-add-topic-button` | div | 底部添加话题按钮 | 始终显示 |

### 历史话题列表项（动态 ID）

每个历史话题项都有唯一的动态 test-id，格式为 `message-header-history-item-{index}`：

| Test ID 模式 | 元素类型 | 描述 | 附加属性 |
|-------------|---------|------|----------|
| `message-header-history-item-{index}` | div | 话题列表项 | `data-selected`: 是否为当前选中话题 |
| `message-header-history-item-name-{index}` | span | 话题名称文本 | - |
| `message-header-history-item-edit-input-{index}` | Input | 话题编辑输入框 | 仅在编辑状态显示 |
| `message-header-history-item-actions-{index}` | div | 操作按钮容器 | 鼠标悬停时显示 |
| `message-header-history-item-edit-button-{index}` | div | 编辑按钮 | 鼠标悬停时显示 |
| `message-header-history-item-delete-button-{index}` | div | 删除按钮 | 鼠标悬停时显示 |

---

## MessagePanel 组件

MessagePanel 组件负责消息输入、任务显示和编辑器功能。

### 主要容器

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `message-panel-container` | div | MessagePanel 主容器 | 始终显示 | - |
| `message-panel-input-area` | div | 输入区域容器 | 始终显示 | `data-focused`: 是否聚焦<br>`data-empty-status`: 是否空状态 |
| `message-panel-input-group` | div | 输入组（包含编辑器） | 始终显示 | - |

### 功能区域

| Test ID | 元素类型 | 描述 | 显示条件 |
|---------|---------|------|----------|
| `message-panel-task-list-wrapper` | div | 任务列表包装器 | taskData?.process?.length > 0 |
| `message-panel-message-queue-wrapper` | div | 消息队列包装器 | queue.length > 0 且非空状态 |

### 装饰元素（空状态）

| Test ID | 元素类型 | 描述 | 显示条件 |
|---------|---------|------|----------|
| `message-panel-magic-role` | div | 麦吉角色动画 | isEmptyStatus && !isMobile |
| `message-panel-magic-role-message` | div | 麦吉欢迎消息气泡 | isEmptyStatus && !isMobile |
| `message-panel-magic-role-greet` | div | 欢迎表情（👋） | isEmptyStatus && !isMobile |
| `message-panel-magic-role-title` | div | 欢迎标题文本 | isEmptyStatus && !isMobile |

---

## ProjectItem 组件

**位置**: `src/opensource/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/index.tsx`

### 元素列表

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `project-item` | div | 项目项容器 | 始终显示 | `data-view-mode`<br>`data-pinned`<br>`data-collaboration`<br>`data-workspace-shortcut` |
| `project-item-icon` | div | 项目图标区域 | 始终显示 | - |
| `project-item-content` | div | 项目内容区域 | 始终显示 | - |
| `project-item-title-wrapper` | div | 标题包装器（FlexBox 组件） | !isEditing | - |
| `project-item-title` | div | 项目标题（SmartTooltip 组件） | !isEditing | `data-editable` |
| `project-item-rename-input` | input | 重命名输入框 | isEditing | - |
| `project-item-time` | div | 时间显示（SmartTooltip 组件） | 始终显示 | `data-sort-type` |
| `project-item-more-button` | div | 更多按钮 | isHover \|\| dropdownVisible | `data-visible` |

### 协作者区域元素

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `project-item-collaborators` | div | 协作者信息容器 | isOtherCollaborationProject | - |
| `project-item-creator-section` | div | 创建者区域 | !isSelfCollaborationProject | - |
| `project-item-creator-label` | div | 创建者标签 | !isSelfCollaborationProject | - |
| `project-item-creator-info` | div | 创建者信息 | !isSelfCollaborationProject | - |
| `project-item-members-section` | div | 成员区域 | isOtherCollaborationProject | - |
| `project-item-members-label` | div | 成员标签 | isOtherCollaborationProject | - |
| `project-item-copy-link-button` | button | 复制链接按钮（MagicButton 组件） | isSelfCollaborationProject | - |

### 上下文菜单元素

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `project-context-open-new-window` | div | 在新窗口打开 | 始终显示 | - |
| `project-context-pin` | div | 固定/取消固定 | onPinProject | `data-pinned` |
| `project-context-rename` | div | 重命名 | onRenameProject && !isWorkspaceShortcut | - |
| `project-context-move-to` | div | 移动到 | !isOtherCollaboration && !isWorkspaceShortcut | - |
| `project-context-copy-link` | div | 复制协作链接 | isCollaborationProject | - |
| `project-context-add-collaborators` | div | 添加协作者 | !isPersonalOrganization | - |
| `project-context-add-workspace-shortcut` | div | 添加工作区快捷方式 | !isPersonalOrganization && !isWorkspaceShortcut | - |
| `project-context-navigate-to-workspace` | div | 导航到工作区 | isWorkspaceShortcut && bind_workspace_id | - |
| `project-context-cancel-workspace-shortcut` | div | 取消工作区快捷方式 | isWorkspaceShortcut && !isSelfCollaboration | - |
| `project-context-delete` | div | 删除项目 | onDeleteProject && !isWorkspaceShortcut | - |

### 组件层级

```
project-item
├── project-item-icon
│   └── <PinnedTag /> (grid mode only)
├── project-item-content
│   ├── project-item-title-wrapper (or project-item-rename-input)
│   │   ├── <PinnedTag /> (list mode only)
│   │   ├── <CollaborationProjectTag />
│   │   └── project-item-title
│   └── project-item-time
├── project-item-more-button
└── project-item-collaborators (optional)
    ├── project-item-creator-section
    │   ├── project-item-creator-label
    │   └── project-item-creator-info
    ├── project-item-members-section
    │   ├── project-item-members-label
    │   └── <AddCollaborators />
    └── project-item-copy-link-button (optional)
```

---

## 测试场景示例

### 场景 1: 测试工作区布局

```typescript
// 验证主容器存在
const container = screen.getByTestId('main-workspace-container')
expect(container).toBeInTheDocument()

// 验证侧边栏存在
const sidebar = screen.getByTestId('workspace-sidebar-wrapper')
expect(sidebar).toBeInTheDocument()

// 验证消息面板包装器并检查页面状态
const messagePanelWrapper = screen.getByTestId('message-panel-wrapper')
expect(messagePanelWrapper).toHaveAttribute('data-workspace-page', 'Chat')
```

### 场景 2: 测试话题头部功能

```typescript
// 验证话题名称显示
const topicName = screen.getByTestId('message-header-topic-name')
expect(topicName).toHaveTextContent('My Topic')

// 点击话题名称进入重命名模式
fireEvent.click(topicName)
const renameInput = screen.getByTestId('message-header-rename-input')
expect(renameInput).toBeInTheDocument()

// 测试新建话题按钮
const newTopicButton = screen.getByTestId('message-header-new-topic-button')
fireEvent.click(newTopicButton)
```

### 场景 3: 测试历史话题列表

```typescript
// 打开历史话题面板
const historyButton = screen.getByTestId('message-header-history-button')
fireEvent.click(historyButton)

// 验证面板存在
const historyPanel = screen.getByTestId('message-header-history-panel')
expect(historyPanel).toBeInTheDocument()

// 测试搜索功能
const searchInput = screen.getByTestId('message-header-history-search-input')
fireEvent.change(searchInput, { target: { value: 'test' } })

// 验证特定话题项（使用索引，而非实际 topic ID）
const topicItem = screen.getByTestId('message-header-history-item-0')
expect(topicItem).toHaveAttribute('data-selected', 'true')

// 鼠标悬停显示操作按钮
fireEvent.mouseEnter(topicItem)
const editButton = screen.getByTestId('message-header-history-item-edit-button-0')
const deleteButton = screen.getByTestId('message-header-history-item-delete-button-0')
```

### 场景 4: 测试分享功能

```typescript
// 获取分享按钮
const shareButton = screen.getByTestId('message-header-share-button')

// 验证按钮状态
expect(shareButton).toHaveAttribute('data-disabled', 'false')

// 点击分享按钮
fireEvent.click(shareButton)
```

### 场景 5: 测试消息输入面板

```typescript
// 验证输入面板容器
const messagePanel = screen.getByTestId('message-panel-container')
expect(messagePanel).toBeInTheDocument()

// 验证输入区域及其状态
const inputArea = screen.getByTestId('message-panel-input-area')
expect(inputArea).toHaveAttribute('data-focused', 'false')
expect(inputArea).toHaveAttribute('data-empty-status', 'true')

// 验证空状态下的欢迎元素
const magicRole = screen.getByTestId('message-panel-magic-role')
const greet = screen.getByTestId('message-panel-magic-role-greet')
expect(greet).toHaveTextContent('👋')
```

### 场景 6: 测试任务列表显示

```typescript
// 当有任务数据时，验证任务列表显示
const taskListWrapper = screen.queryByTestId('message-panel-task-list-wrapper')
if (hasTaskData) {
  expect(taskListWrapper).toBeInTheDocument()
} else {
  expect(taskListWrapper).not.toBeInTheDocument()
}
```

### 场景 7: 测试详情面板模式

```typescript
// 验证详情面板模式
const detailPanel = screen.getByTestId('detail-panel-wrapper')

// 单文件模式
expect(detailPanel).toHaveAttribute('data-detail-mode', 'single')

// 切换到多文件模式后验证
expect(detailPanel).toHaveAttribute('data-detail-mode', 'files')
```

---

## 组件层级全景图

```
main-workspace-container
│
├── workspace-sidebar-wrapper
│   └── detail-panel-wrapper [data-detail-mode: single/files]
│       └── <Detail /> (React 组件，内部需单独添加 test-id)
│
└── message-panel-wrapper [data-workspace-page: Home/Chat/AllProjects]
    │
    ├── (workspacePage !== Home)
    │   └── message-header-container
    │       ├── message-header-topic-section
    │       │   ├── <StatusIcon /> (React 组件)
    │       │   ├── message-header-topic-name (可点击)
    │       │   └── message-header-rename-input (重命名状态)
    │       │
    │       └── message-header-action-buttons
    │           ├── message-header-topic-group
    │           │   ├── message-header-new-topic-button
    │           │   └── message-header-history-button
    │           │       └── (Dropdown)
    │           │           └── message-header-history-panel
    │           │               ├── message-header-history-header
    │           │               │   └── message-header-history-search-input
    │           │               ├── message-header-history-list
    │           │               │   ├── message-header-history-empty (无结果时)
    │           │               │   └── message-header-history-item-{index} (列表项)
    │           │               │       ├── message-header-history-item-name-{index}
    │           │               │       ├── message-header-history-item-edit-input-{index}
    │           │               │       └── message-header-history-item-actions-{index}
    │           │               │           ├── message-header-history-item-edit-button-{index}
    │           │               │           └── message-header-history-item-delete-button-{index}
    │           │               └── message-header-history-add-topic-button
    │           │
    │           └── message-header-share-button [data-disabled]
    │
    ├── (workspacePage === Home)
    │   └── <EmptyWorkspacePanel /> (React 组件，内部需单独添加 test-id)
    │
    └── (workspacePage === Chat && selectedTopic)
        ├── <MessageList /> (React 组件，内部需单独添加 test-id)
        └── message-panel-container
            ├── message-panel-input-area [data-focused, data-empty-status]
            │   ├── message-panel-task-list-wrapper (有任务时)
            │   ├── message-panel-message-queue-wrapper (有队列时)
            │   ├── message-panel-input-group
            │   │   └── <MessageEditor /> (React 组件)
            │   ├── message-panel-magic-role (空状态)
            │   └── message-panel-magic-role-message (空状态)
            │       ├── message-panel-magic-role-greet
            │       └── message-panel-magic-role-title
            │
            └── <TopicExamples /> (空状态，React 组件)
```

---

## 注意事项

### ⚠️ 关键规则

1. **仅原生元素**: `data-testid` 只能添加在原生 HTML 元素上（div, span, button, input 等），不能直接添加在 React 组件上
   - **例外情况**: 某些组件（如 antd 的 Flex、Button、Input 等）会将 props 传递到底层原生元素，可以在这些组件上添加 `data-testid`，但文档中会标注实际的底层元素类型
   - **最佳实践**: 优先在原生 HTML 元素上添加，如果必须添加在组件上，确保该组件会将 props 传递到底层元素
2. **条件渲染**: 部分元素仅在特定条件下渲染，测试时需要模拟相应的状态
3. **动态 ID**: 历史话题列表项使用动态 ID（使用数组索引），不暴露实际 topic ID
4. **状态属性**: 某些元素包含额外的 data 属性用于标识状态（如 `data-selected`, `data-disabled` 等）

### 🎯 最佳实践

1. **使用 data 属性进行状态判断**: 优先使用 `data-*` 属性而不是 class 来判断元素状态
2. **动态 ID 处理**: 对于动态生成的元素，使用模板字符串构建 test-id
3. **等待异步更新**: 使用 `waitFor` 等待条件渲染的元素出现
4. **测试用户流程**: 按照用户实际操作流程编写测试，而不是孤立测试单个元素

### 📝 后续扩展建议

如需更细粒度的测试支持，可以继续为以下子组件添加 test-id：

1. **Detail 组件**: 详情面板内部的文件查看器、编辑器等
2. **MessageList 组件**: 单个消息项、工具卡片、附件等
3. **MessageEditor 组件**: 输入框、工具栏按钮、附件列表等
4. **EmptyWorkspacePanel 组件**: 项目卡片、引导元素等
5. **TopicFilesButton 组件**: 文件树节点、文件操作按钮等

### 🔍 调试技巧

使用以下方法查看所有可用的 test-id：

```typescript
// 获取所有带 data-testid 的元素
const allTestElements = document.querySelectorAll('[data-testid]')
allTestElements.forEach(el => {
  console.log(el.getAttribute('data-testid'), el)
})
```

---

---

## 安全审查报告

### ✅ 审查结果：通过

所有 test-id 已经过安全审查，确保不包含敏感信息。

### 🔒 安全原则

1. **不使用实际 ID**: 所有动态 test-id 使用**列表索引**而非实际的数据库 ID
2. **不暴露用户信息**: test-id 中不包含用户名、邮箱等个人信息
3. **不暴露系统架构**: test-id 命名简洁，不暴露内部实现细节

### ✅ 已修复的安全问题

#### MessageHeader 历史记录项

**问题**: 使用实际 topic ID 作为 test-id 后缀  
**风险**: 暴露内部 ID 结构，可能被攻击者利用

```typescript
// ❌ 修复前 - 暴露实际 ID
data-testid={`message-header-history-item-${topic.id}`}

// ✅ 修复后 - 使用索引
data-testid={`message-header-history-item-${index}`}
```

**修复的 test-id**:
- `message-header-history-item-${index}` 
- `message-header-history-item-edit-input-${index}`
- `message-header-history-item-name-${index}`
- `message-header-history-item-actions-${index}`
- `message-header-history-item-edit-button-${index}`
- `message-header-history-item-delete-button-${index}`

### 📋 审查清单

- ✅ 所有 test-id 不包含用户 ID
- ✅ 所有 test-id 不包含项目 ID  
- ✅ 所有 test-id 不包含 topic ID
- ✅ 所有 test-id 不包含邮箱地址
- ✅ 所有 test-id 不包含 token 或密钥
- ✅ 动态 test-id 使用索引而非实际 ID
- ✅ 附加属性（data-*）仅使用布尔值或枚举值

### 🎯 安全最佳实践

1. **使用索引**: 对于列表项，使用数组索引而非实际 ID
   ```typescript
   items.map((item, index) => (
     <div data-testid={`list-item-${index}`}>
   ```

2. **使用状态标识**: 使用布尔值或枚举值标识状态
   ```typescript
   data-testid="project-item"
   data-pinned={true}
   data-view-mode="grid"
   ```

3. **避免敏感信息**: 永远不要在 test-id 中包含：
   - 用户 ID、邮箱、姓名
   - 项目 ID、文件 ID  
   - Token、密钥、密码
   - 任何可被用于未授权访问的标识符

---

## 更新日志

- **2025-01-XX**: 初始版本，添加 MainWorkspaceContent、MessageHeader 和 MessagePanel 的 test-id
- **2025-01-XX**: 添加 ProjectItem 组件的 test-id
- **重要修正**: 移除了所有错误添加在 React 组件上的 test-id，确保只在原生 HTML 元素上使用
- **安全修复**: 修复 MessageHeader 历史记录项使用实际 ID 的安全问题，改用索引
- **版本**: 1.1 - 已通过安全审查
