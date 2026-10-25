# HTML 编辑器 data-testid 引用

本文档记录 HTML 预览与可视化编辑流程中供单元测试和 E2E 使用的稳定选择器。

FilesViewer 会保留非活动页实例。本次新增的页面级选择器、编辑操作和视图模式选择器只在活动预览上暴露；其他内嵌控件应先定位活动的 `html-preview`，再使用 `within(...)` 或等价的 E2E 作用域查询。Portal 控件不属于根节点后代，只在活动预览中渲染，应从 `document.body` 查询。

## 预览与工具栏

| 元素             | data-testid                      | 说明                                       |
| ---------------- | -------------------------------- | ------------------------------------------ |
| HTML 预览根节点  | `html-preview`                   | 通过 `data-edit-mode` 判断是否处于编辑模式 |
| 可视化预览容器   | `html-preview-container`         | 包含 HTML 画布和加载状态                   |
| 可视化预览内容   | `html-preview-content`           | 预览器内容区域                             |
| 编辑画布         | `html-editor-canvas`             | 承载 iframe、选区和空白区域点击的实际画布  |
| 可视化预览加载态 | `html-preview-loading`           | iframe 尚未完成首次渲染时显示              |
| 代码编辑区域     | `html-editor-code-view`          | 代码模式的编辑容器                         |
| 代码模式按钮     | `view-mode-code`                 | 切换到源码编辑模式                         |
| 桌面预览按钮     | `view-mode-desktop`              | 切换到桌面预览                             |
| 手机预览按钮     | `view-mode-phone`                | 切换到手机预览                             |
| 顶部编辑操作区   | `html-editor-toolbar-actions`    | 快速选取、文件编辑和 AI 编辑的容器         |
| 快速选取         | `html-ai-pick-button`            | 进入或退出单次元素选取                     |
| 服务端更新       | `html-server-update-button`      | 查看编辑期间检测到的服务端更新             |
| 权限管理         | `html-permission-manager-button` | 打开 HTML 权限管理器                       |

## 文件编辑与 AI 编辑

| 元素            | data-testid                          | 说明                                 |
| --------------- | ------------------------------------ | ------------------------------------ |
| 文件编辑操作组  | `html-editor-file-actions`           | 编辑、保存、保存并退出、取消按钮容器 |
| 编辑            | `html-editor-edit-button`            | 进入编辑模式                         |
| 保存            | `html-editor-save-button`            | 保存并保持编辑模式                   |
| 保存并退出      | `html-editor-save-and-exit-button`   | 保存并退出编辑模式                   |
| 取消            | `html-editor-cancel-button`          | 放弃本轮编辑                         |
| AI 编辑操作组   | `html-editor-ai-edit`                | AI 编辑主按钮与菜单按钮容器          |
| AI 编辑主按钮   | `html-editor-ai-edit-primary-button` | 启动多元素选取                       |
| AI 编辑菜单按钮 | `html-editor-ai-edit-menu-button`    | 展开 AI 编辑菜单                     |
| AI 编辑菜单     | `html-editor-ai-edit-menu`           | AI 编辑菜单内容                      |
| AI 编辑菜单项   | `html-editor-ai-edit-item`           | 重复项通过 `data-item-key` 区分      |

## 可视化编辑画布

| 元素                | data-testid                                 | 说明                                               |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| iframe              | `isolated-html-content-iframe`              | 实际承载 HTML 内容的 iframe                        |
| 全局样式工具栏      | `html-editor-style-toolbar`                 | 编辑模式顶部样式工具栏                             |
| 选中元素读数        | `html-editor-selection-readout`             | 顶部工具栏中的标签与尺寸，无选中时显示空态         |
| 选中面包屑          | `html-editor-selection-breadcrumb`          | 祖先路径，悬停预览、点击选中祖先                   |
| 面包屑溢出          | `html-editor-selection-breadcrumb-overflow` | 超过 3 层时左侧省略号，指向更远祖先                |
| 面包屑祖先          | `html-editor-selection-breadcrumb-ancestor` | 可点击祖先节点                                     |
| 面包屑当前          | `html-editor-selection-breadcrumb-current`  | 当前选中节点，不可点击                             |
| 布局约束提示        | `layout-constraint-hint-{kind}`             | kind 为 distributed-alignment 或 parent-owned-size |
| 布局约束修复        | `layout-constraint-hint-apply-{kind}`       | 悬停预览、点击应用修复                             |
| 元素上下文面板      | `html-editor-context-panel`                 | 选中元素旁的浮动面板                               |
| 上下文样式工具栏    | `html-editor-context-style-toolbar`         | 浮动面板中的样式工具栏                             |
| 选区覆盖层          | `html-editor-selection-overlay`             | 元素高亮和变换控制层                               |
| 选中框              | `html-editor-selection-box`                 | 当前选中元素的描边框                               |
| 选中角标            | `html-editor-selection-mark`                | 右上/左下/右下角标，`data-mark-id` 区分            |
| 移动手柄            | `on-move-handle-mouse-down`                 | 拖动选中元素                                       |
| 缩放手柄            | `on-resize-handle-mouse-down`               | 重复项通过 `data-handle-id` 区分                   |
| 旋转手柄            | `on-rotate-handle-mouse-down`               | 旋转选中元素                                       |
| 间距手柄            | `on-gap-handle-pointer-down`                | 拖动 flex/grid 间距，`data-axis` 区分              |
| 页面结构开关        | `html-editor-dom-tree-toggle-button`        | 展开或折叠 DOM 树                                  |
| DOM 树面板          | `html-dom-tree-panel`                       | 页面结构侧栏                                       |
| DOM 树宽度手柄      | `html-dom-tree-resize-handle`               | 调整页面结构侧栏宽度                               |
| DOM 树展开/折叠全部 | `html-dom-tree-expand-toggle-button`        | 展开或折叠全部节点                                 |
| DOM 树刷新          | `html-dom-tree-refresh-button`              | 重新读取页面结构                                   |
| DOM 树关闭          | `html-dom-tree-close-button`                | 关闭页面结构侧栏                                   |
| DOM 树搜索          | `dom-tree-search-input`                     | 搜索页面节点                                       |
| DOM 树加载状态      | `html-dom-tree-loading`                     | DOM 树首次读取中                                   |
| DOM 树加载失败      | `html-dom-tree-load-error`                  | DOM 树读取失败状态                                 |
| DOM 树重试          | `html-dom-tree-retry-button`                | 重新读取 DOM 树                                    |
| DOM 树操作失败      | `html-dom-tree-action-error`                | 新增、移动或删除失败提示                           |

## AI 元素选取与编辑

AI 选取面板可能通过 Portal 挂载到画布容器或 `document.body`。应先从活动 HTML
预览触发 AI 选取，再在 Portal 容器中查询以下选择器。

| 元素               | data-testid                                          | 说明                                                   |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| AI 选取覆盖层      | `element-inspector-overlay`                          | 元素高亮、截图选区和目标编辑的根层                     |
| AI 面板 Portal     | `element-inspector-panel-portal`                     | 待处理目标面板与目标编辑浮层的 Portal                  |
| 待处理目标面板     | `element-inspector-pending-panel`                    | 目标数量、模式选择和提交操作                           |
| 元素选择模式       | `element-inspector-selection-mode-element-button`    | 切换到元素选取                                         |
| 截图选择模式       | `element-inspector-selection-mode-screenshot-button` | 切换到区域截图                                         |
| 待处理目标列表开关 | `element-inspector-pending-target-toggle`            | 展开或折叠目标列表                                     |
| 待处理目标列表     | `element-inspector-pending-target-list`              | 已确认目标列表                                         |
| 待处理目标项       | `element-inspector-pending-target-item`              | 通过运行期 `data-target-id` 和 `data-target-kind` 关联 |
| 编辑待处理目标     | `element-inspector-pending-target-edit-button`       | 重复项通过运行期 `data-target-id` 关联                 |
| 删除待处理目标     | `element-inspector-pending-target-remove-button`     | 重复项通过运行期 `data-target-id` 关联                 |
| 退出 AI 选取       | `element-inspector-exit-button`                      | 退出本次多目标选择                                     |
| 提交 AI 编辑       | `element-inspector-submit-button`                    | 提交全部已确认目标                                     |
| 提交状态           | `element-inspector-submit-status`                    | `data-state` 为 invalid、error 或 succeeded            |
| 目标高亮点击层     | `element-inspector-pending-target`                   | 通过运行期 `data-target-id` 关联，点击重新编辑         |
| 目标描述浮层       | `element-inspector-edit-popover`                     | 通过运行期 `data-target-id` 关联当前目标               |
| 目标描述输入框     | `element-inspector-instruction-input`                | 输入目标修改要求                                       |
| 关闭目标描述浮层   | `element-inspector-edit-close-button`                | 关闭右上角按钮                                         |
| 取消目标编辑       | `element-inspector-edit-cancel-button`               | 放弃本次描述修改                                       |
| 确认目标编辑       | `element-inspector-edit-confirm-button`              | 确认描述并加入待处理列表                               |
| 删除当前目标       | `element-inspector-remove-target-button`             | 编辑已有目标时显示                                     |
| 截图选择覆盖层     | `html-screenshot-selection-overlay`                  | 拖动或键盘确认截图区域                                 |
| 截图选择框         | `html-screenshot-selection-box`                      | 当前截图范围                                           |
| 截图错误           | `html-screenshot-selection-error`                    | 截图失败或当前标签页选择错误                           |
| 元素备注按钮       | `element-inspector-comment-button`                   | 重复项通过运行期 `data-target-id` 关联                 |
| 元素信息卡         | `element-inspector-info-card`                        | 单元素检查信息                                         |
| 关闭元素信息卡     | `element-inspector-info-close-button`                | 清除当前单元素选择                                     |
| 复制元素选择器     | `element-inspector-copy-selector-button`             | 复制 CSS selector                                      |
| 插入控制台         | `element-inspector-insert-console-button`            | 将查询代码写入开发控制台                               |
| 发送给 AI          | `inspector-send-to-agent-button`                     | 将单元素信息发送到输入框                               |

## 元素结构操作

| 元素             | data-testid                                           | 说明                               |
| ---------------- | ----------------------------------------------------- | ---------------------------------- |
| 元素操作组       | `html-style-panel-element-actions`                    | 新增、移动、复制和删除操作         |
| 新增文本菜单按钮 | `html-style-panel-add-element-button`                 | 打开新增文本位置菜单               |
| 新增文本菜单     | `html-style-panel-add-element-menu`                   | 文本插入位置菜单                   |
| 文本插入位置     | `html-style-panel-add-element-{placement}-item`       | placement 为 before、inside、after |
| 新增图片菜单按钮 | `html-style-panel-add-image-element-button`           | 打开新增图片位置菜单               |
| 新增图片菜单     | `html-style-panel-add-image-element-menu`             | 图片插入位置菜单                   |
| 图片插入位置     | `html-style-panel-add-image-element-{placement}-item` | placement 同上                     |
| 元素上移         | `html-style-panel-move-up-button`                     | 在同级节点中向前移动               |
| 元素下移         | `html-style-panel-move-down-button`                   | 在同级节点中向后移动               |
| 替换图片         | `html-style-panel-replace-image-button`               | 替换当前图片元素                   |
| 复制元素         | `html-style-panel-duplicate-button`                   | 复制当前元素                       |
| 删除元素         | `html-style-panel-delete-button`                      | 删除当前元素                       |
| 新增文本弹窗     | `html-style-panel-add-text-dialog`                    | 输入待新增文本                     |
| 新增文本输入框   | `html-style-panel-add-text-input`                     | 文本内容输入                       |
| 取消新增文本     | `html-style-panel-add-text-cancel-button`             | 关闭弹窗                           |
| 确认新增文本     | `html-style-panel-add-text-confirm-button`            | 创建文本节点                       |

DOM 树中与具体节点相关的重复控件使用固定 `data-testid`，通过运行期 `data-node-id` 关联节点：

- 行内操作：`dom-tree-move-up-button`、`dom-tree-move-down-button`、`dom-tree-delete-button`。
- 新增菜单：`dom-tree-add-button` 或 `dom-tree-add-sibling-button`；菜单和菜单项在前缀后追加 `-menu`、`-text-{placement}-item` 或 `-image-{placement}-item`。
- 右键菜单：`dom-tree-context-menu`；操作项使用 `dom-tree-context-menu-{action}-item`。插入子菜单入口和内容分别为 `dom-tree-context-menu-insert-trigger`、`dom-tree-context-menu-insert-content`。
- DOM 树新增文本弹窗：`html-dom-tree-add-text-dialog`、`html-dom-tree-add-text-input`、`html-dom-tree-add-text-cancel-button`、`html-dom-tree-add-text-confirm-button`。
- DOM 树删除确认弹窗：`html-dom-tree-delete-dialog`、`html-dom-tree-delete-cancel-button`、`html-dom-tree-delete-confirm-button`。

## 常用样式操作

全局样式工具栏和元素上下文工具栏可能同时展示相同操作。先定位
`html-editor-style-toolbar` 或 `html-editor-context-style-toolbar`，再在该作用域内查询以下选择器。

| 元素         | data-testid                                    | 说明                                        |
| ------------ | ---------------------------------------------- | ------------------------------------------- |
| 撤销         | `html-editor-history-undo-button`              | 撤销上一步编辑                              |
| 重做         | `html-editor-history-redo-button`              | 重做上一步编辑                              |
| 字体选择     | `html-editor-font-family-trigger`              | 展开字体菜单                                |
| 字体菜单     | `html-editor-font-family-menu`                 | 字体选择菜单                                |
| 字体项       | `html-editor-font-family-item`                 | 重复项通过 `data-font-family` 区分          |
| 字号控件     | `html-editor-font-size-control`                | 字号输入和菜单容器                          |
| 字号输入     | `html-editor-font-size-input`                  | 输入或拖动修改字号                          |
| 字号菜单按钮 | `html-editor-font-size-menu-button`            | 展开预设字号                                |
| 字号菜单     | `html-editor-font-size-menu`                   | 预设字号菜单                                |
| 字号项       | `html-editor-font-size-item`                   | 重复项通过 `data-font-size` 区分            |
| 增大字号     | `html-editor-font-size-increase-button`        | 增大选中元素字号                            |
| 减小字号     | `html-editor-font-size-decrease-button`        | 减小选中元素字号                            |
| 粗体         | `html-editor-text-format-bold-button`          | 切换粗体                                    |
| 斜体         | `html-editor-text-format-italic-button`        | 切换斜体                                    |
| 下划线       | `html-editor-text-format-underline-button`     | 切换下划线                                  |
| 删除线       | `html-editor-text-format-strikethrough-button` | 切换删除线                                  |
| 文本对齐     | `html-editor-text-align-{alignment}-button`    | alignment 为 left、center、right 或 justify |
| Flex 对齐    | `html-editor-flex-align-{value}-button`        | value 为 flex-start、center 或 flex-end     |
| 文本编辑开关 | `html-editor-text-edit-toggle`                 | 进入或退出文本直接编辑                      |
| 文本内容输入 | `html-editor-text-content-input`               | 修改当前元素的直接文本内容                  |
| 文本颜色按钮 | `html-editor-text-color-button`                | 打开浏览器颜色选择器                        |
| 文本颜色输入 | `handle-change`                                | 保留既有 ID，需在样式工具栏作用域内查询     |

## 样式分类弹层

| 分类           | 入口 data-testid                      | 内容 data-testid                      |
| -------------- | ------------------------------------- | ------------------------------------- |
| 尺寸           | `html-style-panel-size-trigger`       | `html-style-panel-size-content`       |
| 布局           | `html-style-panel-layout-trigger`     | `html-style-panel-layout-content`     |
| Flex/Grid      | `html-style-panel-flex-grid-trigger`  | `html-style-panel-flex-grid-content`  |
| 图片           | `html-style-panel-image-trigger`      | `html-style-panel-image-content`      |
| 背景           | `html-style-panel-background-trigger` | `html-style-panel-background-content` |
| 边框           | `html-style-panel-border-trigger`     | `html-style-panel-border-content`     |
| 阴影           | `html-style-panel-shadow-trigger`     | `html-style-panel-shadow-content`     |
| 上下文更多样式 | `style-panel-more-styles-trigger`     | `style-panel-more-styles-content`     |
| 盒模型示意图   | `html-style-panel-box-model`          | `html-style-panel-box-model-content`  |
| 盒模型边输入   | `box-model-edge-{layer}-{side}`       | layer 为 margin/border/padding        |

「更多样式」内部标签使用 `style-panel-more-{type}-tab`，type 为 text、background、border、shadow、image、layout 或 advanced。

## 保存冲突与版本对比

| 元素             | data-testid                                           |
| ---------------- | ----------------------------------------------------- |
| 保存冲突弹窗     | `html-save-with-update-dialog`                        |
| 取消冲突保存     | `html-save-with-update-cancel-button`                 |
| 确认冲突保存     | `html-save-with-update-confirm-button`                |
| 代码版本对比弹窗 | `html-code-version-compare-dialog`                    |
| 使用本地代码版本 | `html-code-version-compare-use-my-version-button`     |
| 使用服务端版本   | `html-code-version-compare-use-server-version-button` |
| 取消代码版本对比 | `html-code-version-compare-cancel-button`             |
| 可视化版本对比   | `ppt-version-compare-dialog`                          |
| 取消可视化对比   | `ppt-version-compare-dialog-cancel`                   |
| 确认可视化版本   | `ppt-version-compare-dialog-confirm`                  |

## 稳定性规则

- 使用 lowercase kebab-case，不依赖界面文案或当前语言。
- 页面内单例保持唯一；重复工具栏控件通过工具栏根节点限定作用域，重复菜单项再通过数据属性区分。
- 本次新增的重复操作使用固定 `data-testid`，不把数组下标、时间戳或随机值拼入动作名称。`data-target-id`、`data-node-id` 等运行期属性只用于关联同一界面中的重复项，自动化不应预先写死其值。
- 自动化操作应优先点击按钮自身的 test id，不点击仅用于布局的外围节点。
