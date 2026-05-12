# TopicFilesButton Data TestID 说明文档

## 概述

本文档列出了 TopicFilesButton 组件及其子组件中所有 `data-testid` 属性，用于自动化测试定位元素。

所有 `data-testid` 命名遵循以下原则：
- 使用 `kebab-case` 命名规范
- 使用语义化格式：`<scope>-<entity>-<action>`
- 范围前缀 `file-` 表示文件相关功能
- 避免依赖 i18n 文本，保持稳定性
- 对于重复元素，使用稳定的业务 key（如 `file_id`）

## 文件树组件 (TopicFilesCore.tsx)

### 文件渲染项

#### 虚拟文件/文件夹（创建新文件时）

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-item-virtual` | 虚拟文件/文件夹容器 | 创建新文件或文件夹时的临时容器 |
| `file-name-input-virtual` | 虚拟文件名输入框 | 创建新文件时的文件名输入框 |
| `folder-name-input-virtual` | 虚拟文件夹名输入框 | 创建新文件夹时的文件夹名输入框 |
| `design-project-name-input-virtual` | 虚拟设计项目名输入框 | 创建新设计项目时的项目名输入框 |

#### 文件夹

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-item-folder-{file_id}` | 文件夹容器 | 文件夹的根容器，`{file_id}` 为文件夹的唯一 ID |
| `file-expand-icon` | 展开/折叠图标 | 文件夹的展开/折叠按钮 |
| `file-name-input-rename` | 重命名输入框 | 文件夹重命名时的输入框 |
| `file-more-actions-button` | 更多操作按钮 | 文件夹的三个点菜单按钮 |

#### 文件

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-item-file-{file_id}` | 文件容器 | 文件的根容器，`{file_id}` 为文件的唯一 ID |
| `file-expand-icon-placeholder` | 展开图标占位符 | 文件无子项时的占位元素 |
| `file-name-input-rename` | 重命名输入框 | 文件重命名时的输入框 |
| `file-more-actions-button` | 更多操作按钮 | 文件的三个点菜单按钮 |

### 批量操作

| TestID | 元素 | 说明 |
|--------|------|------|
| `batch-operations-button` | PC 端批量操作按钮 | PC 端的批量操作下拉按钮 |
| `mobile-cancel-select-button` | 移动端取消选择按钮 | 移动端取消批量选择模式的按钮 |
| `mobile-batch-operations-button` | 移动端批量操作按钮 | 移动端的批量操作下拉按钮 |

## 头部组件

### 普通模式头部 (NormalModeHeader.tsx)

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-header-search-button` | 搜索按钮 | 进入搜索模式的按钮 |
| `file-header-add-file-button` | 添加文件按钮 | 打开添加文件菜单的按钮 |
| `file-header-add-folder-button` | 添加文件夹按钮 | 创建新文件夹的按钮 |
| `file-header-upload-button` | 上传按钮 | 打开上传菜单的按钮 |
| `file-header-refresh-button` | 刷新按钮 | 刷新文件列表的按钮 |
| `file-header-select-mode-button` | 进入选择模式按钮 | 进入批量选择模式的按钮 |

### 搜索模式头部 (SearchModeHeader.tsx)

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-search-input` | 搜索输入框 | 搜索文件名的输入框 |
| `file-search-close-button` | 关闭搜索按钮 | 退出搜索模式的按钮 |

### 选择模式头部 (SelectModeHeader.tsx)

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-select-all-checkbox` | 全选复选框 | 全选/取消全选所有文件的复选框 |
| `file-select-cancel-button` | 取消选择按钮 | 退出选择模式的按钮 |

## 空状态组件 (EmptyState.tsx)

| TestID | 元素 | 说明 |
|--------|------|------|
| `file-empty-create-button` | 创建文件按钮 | 空状态下创建文件的按钮 |
| `file-empty-upload-button` | 上传文件按钮 | 空状态下上传文件的按钮 |

## 使用示例

### Vitest + React Testing Library

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('TopicFilesButton', () => {
  it('should open search mode when clicking search button', async () => {
    const user = userEvent.setup()
    render(<TopicFilesPanel />)
    
    // 点击搜索按钮
    const searchButton = screen.getByTestId('file-header-search-button')
    await user.click(searchButton)
    
    // 验证搜索输入框出现
    const searchInput = screen.getByTestId('file-search-input')
    expect(searchInput).toBeInTheDocument()
  })
  
  it('should display file items', () => {
    render(<TopicFilesCore attachments={mockFiles} />)
    
    // 查找特定文件
    const fileItem = screen.getByTestId('file-item-file-12345')
    expect(fileItem).toBeInTheDocument()
  })
  
  it('should toggle folder expansion', async () => {
    const user = userEvent.setup()
    render(<TopicFilesCore attachments={mockFiles} />)
    
    // 点击展开图标
    const expandIcon = screen.getAllByTestId('file-expand-icon')[0]
    await user.click(expandIcon)
    
    // 验证子文件显示
    // ...
  })
})
```

### Playwright E2E 测试

```typescript
import { test, expect } from '@playwright/test'

test('file operations', async ({ page }) => {
  await page.goto('/workspace/project/123')
  
  // 打开添加文件菜单
  await page.getByTestId('file-header-add-file-button').click()
  
  // 等待文件创建
  await expect(page.getByTestId('file-item-virtual')).toBeVisible()
  
  // 输入文件名
  await page.getByTestId('file-name-input-virtual').fill('test.md')
  await page.getByTestId('file-name-input-virtual').press('Enter')
  
  // 验证文件已创建
  await expect(page.getByText('test.md')).toBeVisible()
})

test('batch operations', async ({ page }) => {
  await page.goto('/workspace/project/123')
  
  // 进入选择模式
  await page.getByTestId('file-header-select-mode-button').click()
  
  // 全选文件
  await page.getByTestId('file-select-all-checkbox').click()
  
  // 打开批量操作菜单
  await page.getByTestId('batch-operations-button').click()
  
  // 选择下载操作
  await page.getByText('批量下载').click()
})
```

### Cypress E2E 测试

```typescript
describe('File Operations', () => {
  it('should search files', () => {
    cy.visit('/workspace/project/123')
    
    // 点击搜索按钮
    cy.getByTestId('file-header-search-button').click()
    
    // 输入搜索关键词
    cy.getByTestId('file-search-input').type('README')
    
    // 验证搜索结果
    cy.contains('README.md').should('be.visible')
    
    // 关闭搜索
    cy.getByTestId('file-search-close-button').click()
  })
  
  it('should rename file', () => {
    cy.visit('/workspace/project/123')
    
    // 点击文件的更多操作按钮
    cy.getByTestId('file-item-file-12345')
      .find('[data-testid="file-more-actions-button"]')
      .click()
    
    // 选择重命名
    cy.contains('重命名').click()
    
    // 输入新文件名
    cy.getByTestId('file-name-input-rename')
      .clear()
      .type('new-name.md{enter}')
    
    // 验证文件名已更新
    cy.contains('new-name.md').should('be.visible')
  })
})
```

## 维护指南

### 添加新的 TestID

当添加新功能或组件时，请遵循以下步骤：

1. **确定元素类型**：确定需要添加 testid 的元素（按钮、输入框、容器等）
2. **命名规范**：使用 `file-<entity>-<action>` 格式
3. **添加 testid**：在 JSX 元素上添加 `data-testid` 属性
4. **更新文档**：在本文档中添加新的 testid 说明
5. **编写测试**：为新功能编写测试用例

### 修改现有 TestID

**⚠️ 注意**：修改现有的 `data-testid` 会导致已有测试失败，请谨慎操作！

如果确实需要修改：

1. **搜索使用**：全局搜索 testid，找到所有使用位置
2. **更新测试**：更新所有相关的测试用例
3. **更新文档**：更新本文档中的说明
4. **通知团队**：通知团队成员 testid 已更改

### 删除 TestID

只有在功能完全移除时才删除 testid：

1. **确认功能移除**：确认功能和相关测试已完全移除
2. **删除 testid**：从代码中删除 `data-testid` 属性
3. **更新文档**：从本文档中删除相关说明

## 最佳实践

### DO ✅

- 使用稳定的、语义化的命名
- 为所有交互元素添加 testid
- 使用业务 ID（如 `file_id`）区分重复元素
- 保持命名简洁清晰
- 及时更新文档

### DON'T ❌

- 不要使用动态值（时间戳、随机值）
- 不要依赖 i18n 文本或翻译
- 不要使用数组索引作为后缀（当顺序可能改变时）
- 不要在 testid 中包含敏感信息（密码、token 等）
- 不要随意修改已存在的 testid

## 常见问题

### Q: 为什么不直接使用文本查询（如 `getByText`）？

A: 文本查询依赖于 i18n 翻译，在多语言环境下不稳定。`data-testid` 提供了一个与文本无关的稳定选择器。

### Q: 什么时候使用带 `file_id` 后缀的 testid？

A: 当页面上可能存在多个相同类型的元素时（如多个文件项），使用唯一的业务 ID 作为后缀可以精确定位特定元素。

### Q: 如何测试动态生成的列表？

A: 使用 `getAllByTestId` 获取所有匹配的元素，或者使用 `within` 配合容器的 testid 限定查询范围。

```typescript
// 获取所有文件项
const fileItems = screen.getAllByTestId(/^file-item-file-/)

// 在特定容器内查询
const container = screen.getByTestId('file-list-container')
const button = within(container).getByTestId('file-more-actions-button')
```

### Q: 移动端和 PC 端的 testid 有什么区别？

A: 某些功能在移动端和 PC 端有不同的实现，这些元素会有 `mobile-` 前缀（如 `mobile-batch-operations-button`），以区分不同平台的元素。

## 相关资源

- [React Testing Library 最佳实践](https://testing-library.com/docs/queries/about/#priority)
- [Playwright 测试文档](https://playwright.dev/docs/locators)
- [Cypress 测试文档](https://docs.cypress.io/guides/references/best-practices)
- [项目测试规范](.cursor/rules/code-assurance-testing.mdc)
