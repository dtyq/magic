# PPTRender data-testid 引用文档

本文档列出了 PPTRender 组件及其子组件中所有可用的 `data-testid` 属性，便于单元测试和 E2E 测试使用 `getByTestId` 进行稳定元素选择。

FilesViewer 会保留非活动页实例。项目级固定选择器和本次新增的编辑工具栏选择器只在活动 PPT 预览上暴露；查询时优先以 `ppt-project-preview` 为作用域。

## 命名规范

- 使用 lowercase kebab-case
- 格式：`<scope>-<entity>-<action>`
- 文本无关，不依赖 i18n 文案
- 避免动态/随机值

## 查询优先级

在编写或更新测试时：

- 优先使用 `getByTestId` 获取稳定选择器
- 使用 `getByRole`、`getByLabelText`、`getByText` 作为补充断言
- 避免使用 `container.querySelector(...)` 选择器

---

## PPTRender (index.tsx)

| 元素                    | data-testid                            | 说明                       |
| ----------------------- | -------------------------------------- | -------------------------- |
| 根容器                  | `ppt-render-container`                 | 整体渲染容器               |
| 展开侧边栏按钮          | `ppt-render-expand-sidebar-button`     | 侧边栏折叠时显示的展开按钮 |
| 侧边栏                  | `ppt-render-sidebar`                   | 缩略图侧边栏容器           |
| 侧边栏调整手柄          | `ppt-render-sidebar-resize-handle`     | 拖拽调整侧边栏宽度的手柄   |
| 主内容区                | `ppt-render-slide-content`             | 幻灯片主展示区域           |
| 加载层                  | `ppt-render-loading`                   | 初始化加载状态遮罩         |
| 空态                    | `ppt-render-empty`                     | 无幻灯片时的空态展示       |
| 创建首张幻灯片按钮      | `ppt-render-create-first-slide-button` | 空态下的创建按钮           |
| 导航确认对话框          | `ppt-render-navigation-dialog`         | 编辑中切换页时的确认弹窗   |
| 导航对话框 - 取消       | `ppt-render-navigation-dialog-cancel`  | 取消导航                   |
| 导航对话框 - 丢弃并跳转 | `ppt-render-navigation-dialog-discard` | 丢弃修改并跳转             |
| 导航对话框 - 保存并跳转 | `ppt-render-navigation-dialog-save`    | 保存后跳转                 |

## PPT 项目预览与编辑工具栏

| 元素               | data-testid                                 | 说明                                       |
| ------------------ | ------------------------------------------- | ------------------------------------------ |
| PPT 项目预览根节点 | `ppt-project-preview`                       | 包含加载态和 PPTRender 的项目级预览容器    |
| PPT 项目加载态     | `ppt-project-preview-loading`               | 首次解析入口文件或 magic.project.js 时显示 |
| 编辑工具栏操作区   | `ppt-edit-toolbar-actions`                  | PPT 预览顶部编辑工具栏                     |
| 视图模式切换       | `ppt-edit-toolbar-view-mode-switcher`       | 代码与预览模式切换                         |
| 代码模式           | `ppt-edit-toolbar-view-mode-code-button`    | 切换到代码模式的实际按钮                   |
| 预览模式           | `ppt-edit-toolbar-view-mode-desktop-button` | 切换到桌面预览模式的实际按钮               |
| 服务端更新         | `ppt-edit-toolbar-server-update-button`     | 查看服务端更新                             |
| 快速选取           | `ppt-edit-toolbar-quick-select-button`      | 进入或退出快速元素选取                     |
| 文件编辑操作组     | `ppt-edit-toolbar-file-actions`             | 编辑、保存、保存并退出、取消按钮容器       |
| 编辑               | `ppt-edit-toolbar-edit-button`              | 进入当前幻灯片编辑模式                     |
| 保存               | `ppt-edit-toolbar-save-button`              | 保存当前幻灯片                             |
| 保存并退出         | `ppt-edit-toolbar-save-and-exit-button`     | 保存并退出编辑模式                         |
| 取消               | `ppt-edit-toolbar-cancel-button`            | 放弃本轮编辑                               |
| AI 编辑操作组      | `ppt-edit-toolbar-ai-edit`                  | AI 编辑主按钮与菜单按钮容器                |
| AI 编辑主按钮      | `ppt-edit-toolbar-ai-edit-primary-button`   | 执行主要 AI 编辑动作                       |
| AI 编辑菜单按钮    | `ppt-edit-toolbar-ai-edit-menu-button`      | 展开 AI 编辑菜单                           |
| AI 编辑菜单        | `ppt-edit-toolbar-ai-edit-menu`             | AI 编辑菜单内容                            |
| AI 编辑菜单项      | `ppt-edit-toolbar-ai-edit-item`             | 重复项通过 `data-item-key` 区分            |
| 刷新               | `ppt-edit-toolbar-refresh-button`           | 刷新当前幻灯片                             |
| 全屏               | `ppt-edit-toolbar-fullscreen-button`        | 进入或退出 PPT 演示全屏                    |

---

## PPTSlide (PPTSlide.tsx)

| 元素                 | data-testid                                  | 说明                                  |
| -------------------- | -------------------------------------------- | ------------------------------------- |
| 幻灯片项             | `ppt-slide-item-{fileId}` / `ppt-slide-item` | 单张幻灯片根节点，`fileId` 为业务主键 |
| 加载状态             | `ppt-slide-loading`                          | 幻灯片内容加载中                      |
| 空闲状态             | `ppt-slide-idle`                             | 幻灯片未加载完成                      |
| 空内容               | `ppt-slide-empty`                            | 幻灯片内容为空                        |
| 保存提示对话框       | `ppt-slide-save-dialog`                      | 切换前未保存的提示弹窗                |
| 保存对话框 - 丢弃    | `ppt-slide-save-dialog-discard`              | 丢弃修改                              |
| 保存对话框 - 保存    | `ppt-slide-save-dialog-save`                 | 保存修改                              |
| 服务端更新确认对话框 | `ppt-slide-save-with-update-dialog`          | 保存时检测到服务端有更新时的确认弹窗  |

---

## PPTSidebar & SortableSlideItem

| 元素                | data-testid                         | 说明                                     |
| ------------------- | ----------------------------------- | ---------------------------------------- |
| 侧边栏根节点        | `ppt-sidebar`                       | 侧边栏整体容器                           |
| 折叠按钮            | `ppt-sidebar-collapse-button`       | 折叠/展开侧边栏                          |
| 添加幻灯片按钮      | `ppt-sidebar-add-slide-button`      | 新增幻灯片                               |
| 幻灯片列表          | `ppt-sidebar-slides-list`           | 缩略图列表 ScrollArea                    |
| 空态                | `ppt-sidebar-empty`                 | 无幻灯片时的侧边栏空态                   |
| 幻灯片项            | `ppt-sidebar-slide-item-{item.id}`  | 单张幻灯片缩略图项，`item.id` 为业务主键 |
| 重命名对话框        | `ppt-sidebar-rename-dialog`         | 幻灯片重命名弹窗                         |
| 重命名输入框        | `ppt-sidebar-rename-dialog-input`   | 重命名输入                               |
| 重命名对话框 - 取消 | `ppt-sidebar-rename-dialog-cancel`  | 取消重命名                               |
| 重命名对话框 - 确认 | `ppt-sidebar-rename-dialog-confirm` | 确认重命名                               |

---

## PPTControlBar (PPTControlBar.tsx)

| 元素         | data-testid                         | 说明                        |
| ------------ | ----------------------------------- | --------------------------- |
| 控制栏根节点 | `ppt-control-bar`                   | 底部控制栏                  |
| 上一页       | `ppt-control-bar-prev-button`       | 上一张幻灯片                |
| 下一页       | `ppt-control-bar-next-button`       | 下一张幻灯片                |
| 页码指示器   | `ppt-control-bar-page-indicator`    | 当前页 / 总页数，点击可跳转 |
| 跳转输入框   | `ppt-control-bar-jump-input`        | 跳转到指定页的输入框        |
| 首页         | `ppt-control-bar-first-button`      | 跳转到第一张                |
| 刷新         | `ppt-control-bar-refresh-button`    | 刷新幻灯片                  |
| 全屏         | `ppt-control-bar-fullscreen-button` | 进入/退出全屏               |

---

## PPTSlideError (PPTSlideError.tsx)

| 元素     | data-testid       | 说明                       |
| -------- | ----------------- | -------------------------- |
| 错误展示 | `ppt-slide-error` | 幻灯片加载失败时的错误状态 |

---

## VersionHistorySelector

| 元素           | data-testid                   | 说明                           |
| -------------- | ----------------------------- | ------------------------------ |
| 历史版本按钮   | `ppt-version-history-trigger` | 工具栏「历史版本」下拉触发按钮 |
| 历史版本列表项 | `ppt-version-history-item`    | 下拉中的版本项，可用 nth 选取  |

---

## VersionCompareDialog

| 元素       | data-testid                          | 说明                     |
| ---------- | ------------------------------------ | ------------------------ |
| 对话框内容 | `ppt-version-compare-dialog`         | 本地与服务端版本对比弹窗 |
| 取消       | `ppt-version-compare-dialog-cancel`  | 关闭弹窗                 |
| 确认       | `ppt-version-compare-dialog-confirm` | 确认选择版本             |

---

## HistoryVersionCompareDialog

| 元素       | data-testid                                  | 说明                  |
| ---------- | -------------------------------------------- | --------------------- |
| 对话框内容 | `ppt-history-version-compare-dialog`         | 历史版本对比弹窗      |
| 取消       | `ppt-history-version-compare-dialog-cancel`  | 关闭弹窗              |
| 确认       | `ppt-history-version-compare-dialog-confirm` | 确认（回滚/保留当前） |

---

## 使用示例

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PPTRender from "./index"

test("should expand sidebar when expand button is clicked", async () => {
	render(<PPTRender {...mockProps} />)

	const expandButton = screen.getByTestId("ppt-render-expand-sidebar-button")
	await userEvent.click(expandButton)

	expect(screen.getByTestId("ppt-render-sidebar")).toBeInTheDocument()
})

test("should navigate to next slide", async () => {
	render(<PPTRender {...mockProps} />)

	const nextButton = screen.getByTestId("ppt-control-bar-next-button")
	await userEvent.click(nextButton)

	// Assert slide change
})
```

---

## 稳定性规则

- 不以可能变化的数组下标生成 testid
- 不以随机值或时间戳生成 testid
- 页面内单例 id 保持唯一
- 对重复组件，使用共享子 id，并通过 `within(...)` 限定作用域
