# Magic Widget SDK 接入说明

Magic Widget SDK 是一个用于第三方站点接入 Magic Web 的浏览器 UMD 脚本。第三方站点加载脚本后，可以调用 `window.MagicWidget.mount(...)` 显示一个悬浮消息按钮；点击按钮后按钮会隐藏，并在 iframe 面板中打开 Magic Web 页面。

## 脚本地址

请使用目标 Magic Web 部署站点提供的 SDK 脚本：

```html
<script src="https://your-magic-domain.com/sdk/magic-widget.js"></script>
```

iframe 的域名会从脚本地址中推断。例如脚本来自 `https://your-magic-domain.com/sdk/magic-widget.js`，iframe 也会在 `https://your-magic-domain.com` 下打开。

SDK 不提供独立的 `appOrigin` 配置。脚本地址决定 Magic Web Origin；同一 Origin 下的 SaaS 或私有化部署环境通过 `auth.deploymentCode` 选择。

## 快速接入

请在 `document.body` 已存在后调用 `mount`：

```html
<script src="https://your-magic-domain.com/sdk/magic-widget.js"></script>
<script>
	window.MagicWidget.mount({
		page: {
			type: "crew",
			crewId: "crew-001",
		},
		auth: {
			loginStrategy: "phone_password",
			deploymentCode: "private-mock",
			organizationCode: "org-001",
		},
		config: {
			layout: "desktop",
			shell: { appSidebar: false },
			responsive: {
				mobileDetection: "device-and-viewport",
			},
			conversation: {
				projectFiles: false,
				topicHistory: true,
				previewMode: "switchable",
			},
		},
		modal: {
			title: "Magic Assistant",
			width: 480,
			height: 680,
		},
	})
</script>
```

如果脚本在 `head` 中异步加载，或调用时机早于 `body` 创建，请延后调用：

```html
<script>
	window.addEventListener("DOMContentLoaded", function () {
		window.MagicWidget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})
	})
</script>
```

## 运行时 API

UMD 脚本会暴露一个全局对象：

```ts
window.MagicWidget
```

| 方法              | 签名                                                           | 作用                                                                                    | 边界限制                                                                                                        |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `mount`           | `(options: MagicWidget.MountOptions) => void`                  | 创建 widget 并显示悬浮按钮。重复调用 `mount` 会销毁上一次实例，并使用新的配置重新创建。 | 必须在浏览器文档中调用，并且调用时 `document.body` 需要存在。                                                   |
| `open`            | `() => void`                                                   | 主动打开面板。面板打开时，悬浮按钮会隐藏。                                              | 必须在 `mount` 后调用；未挂载时调用会抛错。                                                                     |
| `close`           | `() => void`                                                   | 主动关闭面板。关闭动画结束后，悬浮按钮会重新显示。                                      | 面板已关闭时调用不会产生额外影响。                                                                              |
| `destroy`         | `() => void`                                                   | 移除 widget DOM、事件监听、定时器与当前配置。                                           | 调用后如需再次打开，需要先重新 `mount`。                                                                        |
| `on`              | `on(event, listener)`                                          | 订阅配置警告、Agent 就绪、预览状态和运行时事件，并返回取消订阅函数。                    | 每种事件对应不同的 listener 签名，详见下方“事件 API”。                                                          |
| `setInput`        | `(content: string \| InputContent) => Promise<void>`           | 替换 Agent 输入框内容并聚焦，但不发送。                                                 | 接受非空文本或通过校验的文本/Mention blocks；`blocks` 数量与 Mention 长度均无上限，边界见「Mention 设置边界」。 |
| `appendInput`     | `(content: string \| InputContent) => Promise<void>`           | 将文本或 Mention blocks 追加到当前输入末尾，但不发送。                                  | 保留传入 blocks 的顺序；`blocks` 数量与 Mention 长度均无上限，边界见「Mention 设置边界」。                      |
| `clearInput`      | `() => Promise<void>`                                          | 清空当前输入框并聚焦，不发送消息。                                                      | 以 iframe response 为准。                                                                                       |
| `getInput`        | `() => Promise<string>`                                        | 返回当前输入框的纯文本内容。                                                            | 以 iframe response 为准。                                                                                       |
| `sendMessage`     | `(content?: string \| InputContent) => Promise<void>`          | 发送传入内容；省略 content 时发送当前编辑器内容。                                       | 复用编辑器现有发送校验和会话链路；结构化 content 的边界见「Mention 设置边界」。                                 |
| `newConversation` | `() => Promise<void>`                                          | 创建并选中新对话，Promise 在新编辑器再次 `agent_ready` 后完成。                         | 创建失败或新编辑器超时就绪时 Promise 会拒绝。                                                                   |
| `updateConfig`    | `(config: Partial<MagicWidget.WidgetConfig>) => Promise<void>` | 增量更新当前嵌入页面的展示配置。                                                        | 不更新 URL、不替换 `iframe.src`，也不刷新 iframe。                                                              |

同时可以通过 `window.MagicWidget.version` 获取当前脚本版本，便于排查接入问题。

### 事件 API

#### `config.warning`

```ts
on(event: "config.warning", listener: (warning: MagicWidget.ConfigWarning) => void): () => void
```

当 `panel.customGroups` 超过数量或 UTF-8 JSON 字节限制时，SDK 会按原顺序过滤超限内容、继续挂载或更新 Widget，并触发一次聚合警告。SDK 同时输出 `console.warn`，宿主可以通过事件决定是否展示 Toast、记录日志或上报埋点。建议在 `mount` 前订阅，以接收初始配置的过滤结果：

```js
const unsubscribeConfigWarning = window.MagicWidget.on("config.warning", (warning) => {
	if (warning.code === "CUSTOM_MENTION_FILTERED") {
		showHostWarning(warning.message, warning.details)
	}
})
```

`warning.details` 包含被过滤的分组数、条目数和以下原因：

- `MAX_GROUPS`：仅保留前 50 个分组。
- `MAX_ITEMS_PER_GROUP`：每组仅保留前 1,000 条候选内容。
- `MAX_TOTAL_ITEMS`：全部分组按配置顺序最多保留 5,000 条。
- `MAX_ITEM_BYTES`：过滤 UTF-8 JSON 超过 32 KiB 的单条内容。
- `MAX_PAYLOAD_BYTES`：完整快照按配置顺序保留到 2 MiB；不能再放入的条目或分组会被过滤。

数量或字节超限不会让 `mount` 抛错，也不会让 `updateConfig` reject；不会刷新 iframe 或清空已有会话状态。字段缺失、重复 ID、内置 ID 冲突、未知字段、循环对象和非 JSON-safe 值仍属于结构错误，会继续返回 `INVALID_CONFIG`，且不会部分替换旧快照。

#### `message.stream.started`

```ts
on(event: "message.stream.started", listener: (event: MagicWidget.MessageStreamStartedEvent) => void): () => void
```

当 Magic Web 接受新流代次的首个有序 chunk 时，SDK 会将完整流开始事件实时透传给宿主：

```js
const unsubscribeStreamStarted = window.MagicWidget.on("message.stream.started", (event) => {
	// Show temporary host feedback without depending on Magic Web's internal payload shape.
	showHostStreamingState(event)
})
```

- 流可能由元数据、reasoning、正文或工具调用数据启动；具体分类由 Magic Web 当前事件 payload 提供。
- 同一 correlation 发生流重启时可能产生新的流代次和新的 started 事件。
- SDK 只稳定承诺事件名；`meta` 与 `payload` 由 Magic Web 管理，宿主如需读取具体字段，应在自身业务边界内校验或窄化。

#### `toolCall.settled`

```ts
on(event: "toolCall.settled", listener: (event: MagicWidget.ToolCallSettledEvent) => void): () => void
```

当 Magic Web 发布工具调用结算事件时，SDK 会将完整事件对象实时透传给宿主：

```js
const unsubscribeTool = window.MagicWidget.on("toolCall.settled", (event) => {
	// Refresh host state without depending on Magic Web's internal payload shape.
	void refreshHostToolState(event)
})
```

- SDK 只稳定承诺事件名；`meta` 与 `payload` 由 Magic Web 管理，公共类型不会固定其字段结构。
- SDK 不解释、裁剪、去重或重新分类工具事件；Magic Web 发布什么就透传什么。
- 宿主如需读取当前数据结构，应在自己的业务边界内校验或窄化 `event.payload`。

#### `task.completed`

```ts
on(event: "task.completed", listener: (event: MagicWidget.TaskCompletedEvent) => void): () => void
```

当 Magic Web 发布任务完成事件时，SDK 会将完整事件对象实时透传给宿主：

```js
const unsubscribeTask = window.MagicWidget.on("task.completed", (event) => {
	// Refresh host state without depending on Magic Web's internal payload shape.
	void refreshHostTaskState(event)
})
```

SDK 不定义“任务完成”的内部判断条件，也不解释结果数据；事件是否产生以及携带哪些字段完全沿用 Magic Web 当前行为。

这些运行时事件都只提供浏览器实时通知：不 replay 注册前事件，不承诺 Widget 销毁、iframe 重载、页面后台、网络中断、离线或其他设备事件送达。宿主可据此更新临时 UI 或主动刷新业务接口，但不应将其作为不可丢失的业务凭证。SDK 不增加当前话题过滤；Magic Web 实际发布并被 iframe 观察到的事件会直接透传。

#### `preview_fullscreen`

```ts
on(event: "preview_fullscreen", listener: (isFullscreen: boolean) => void): () => void
```

当 Agent 预览进入或退出全屏呈现状态时，SDK 会向宿主传递完整的布尔状态：

- `true`：预览已进入全屏呈现状态。
- `false`：预览已退出全屏呈现状态，或当前没有处于全屏状态的预览。
- 订阅成功后，listener 会立即同步收到一次当前状态；尚未进入全屏时为 `false`。宿主可据此在下一次绘制前完成初始布局。
- 后续仅在状态发生变化时再次通知。iframe 重新加载、Widget 销毁或全屏预览退出时，状态会重置为 `false`。
- 返回值是取消订阅函数。组件卸载或宿主不再关注状态时应调用它，避免残留监听。

该事件只描述 Agent 内部预览状态。SDK 不会自动放大、Portal 或重设 Widget 容器样式；如果需要覆盖宿主视口，应由宿主根据事件调整容器布局：

```js
const container = document.querySelector("#agent-slot")

const unsubscribePreviewFullscreen = window.MagicWidget.on("preview_fullscreen", (isFullscreen) => {
	// Keep the host-owned container aligned with the complete SDK state snapshot.
	container.classList.toggle("agent-preview-fullscreen", isFullscreen)
})

window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: container,
})

// Keep this function and invoke it when the host component is cleaned up.
// unsubscribePreviewFullscreen()
```

```css
.agent-preview-fullscreen {
	position: fixed;
	inset: 0;
	z-index: 1000;
}
```

建议先订阅再调用 `mount`，这样宿主可以覆盖首次挂载以及后续重新挂载的完整状态变化。若同时订阅多个事件，需要分别保存并调用各自的取消订阅函数。

#### `agent_ready`

```ts
on(event: "agent_ready", listener: () => void): () => void
```

`agent_ready` 表示当前 iframe 已完成页面初始化和编辑器事件订阅，并且当前话题的草稿阶段已经结束。它是状态通知，不是普通命令的强制执行前置条件。若宿主首次操作必须等待该状态，应在 `mount` 前订阅，并在首次触发后取消订阅。

## Mount 参数

```ts
namespace MagicWidget {
	type HeaderActionName =
		"fullscreen" | "pin" | "newTopic" | "history" | "share" | "more" | "close"

	interface HeaderActionContext {
		action: HeaderActionName
		topicId?: string
		topicName?: string
	}

	interface MountOptions {
		page: PageOptions
		auth?: AuthOptions
		config?: WidgetConfig
		iframe?: IframeOptions
		modal?: ModalOptions
		target?: HTMLElement
		headerActions?: Partial<
			Record<HeaderActionName, (context: HeaderActionContext) => void | Promise<void>>
		>
		/** Resolves host-owned candidates for a non-empty search; superseded calls are cancelled via `signal`. */
		customMentionSearch?: (context: {
			query: string
			scope: { type: "global" } | { type: "group"; groupId: string }
			signal: AbortSignal
		}) => Promise<Array<{ groupId: string; items: CustomMentionItem[] }>>
	}
}
```

### 内联模式

传入已连接到当前文档的 `HTMLElement` 作为 `target`，可将 iframe 直接渲染到指定容器：

```js
const container = document.querySelector("#agent-slot")
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: container,
})
window.MagicWidget.setInput("请整理这段虚构内容")
window.MagicWidget.sendMessage("请立即处理这段虚构内容")
```

### Agent 就绪与输入维护

`agent_ready` 表示当前 iframe 已完成页面初始化和编辑器事件订阅，并且当前话题的草稿阶段已经通过成功恢复、主动跳过或失败降级结束。它只是状态通知，SDK 和 iframe bridge 都不会把它作为普通命令的执行前置条件。iframe 文档完成加载后，普通命令会直接发送，不会在 bridge 内等待或排队到 `agent_ready`。

如果宿主首次操作必须发生在已有话题草稿处理完成之后，应由宿主业务逻辑自行等待一次 `agent_ready`。建议在 `mount` 前订阅，避免错过首次事件：

```js
const firstAgentReady = new Promise((resolve) => {
	const unsubscribe = window.MagicWidget.on("agent_ready", () => {
		unsubscribe()
		resolve()
	})
})

window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
})

await firstAgentReady
await window.MagicWidget.setInput("虚构任务前缀")
await window.MagicWidget.appendInput("，请继续处理")
const currentInput = await window.MagicWidget.getInput()
await window.MagicWidget.clearInput()
```

`getInput` 返回纯文本，不暴露 TipTap 或内部 Mention JSON。`appendInput` 不会触发发送。`setInput` 会替换当前编辑器内容，但不会删除持久化的草稿历史；后续仍沿用当前话题原有的草稿保存流程。

结构化输入使用 SDK 自有 blocks，不直接暴露 TipTap JSON：

```js
const input = {
	blocks: [
		{ type: "text", text: "请让 " },
		{
			type: "mention",
			mention: {
				type: "agent",
				data: {
					agent_id: "agent-mock-001",
					agent_name: "Agent Mock",
				},
			},
		},
		{ type: "text", text: " 检查这个虚构任务。" },
	],
}

await window.MagicWidget.setInput(input)
await window.MagicWidget.appendInput({
	blocks: [
		{
			type: "mention",
			mention: {
				type: "tool",
				data: { id: "tool-mock-001", name: "Tool Mock" },
			},
		},
	],
})
await window.MagicWidget.sendMessage()
```

Mention 输入统一使用 `{ type, data }`。Magic Web 已注册类型继续沿用原有校验、展示、草稿和发送行为；协议也会保留非空的未知类型作为通用节点，但不承诺其后端语义。原始 TipTap JSON 和空 `blocks` 会以 `INVALID_INPUT` 拒绝；`data` 只要求是可跨窗口传输的对象，不再递归限制其内部字段。该入口不设条数或字节上限，其 `data` 长度也不受 `config.panel.customGroups` 的 64 / 512 字符限制约束；两条入口的上限对照见「Mention 设置边界」。

SDK 专用的 `text` Mention 要求 `data.id`、`data.label`、`data.text` 都是非空字符串。编辑器显示 `@label`，编辑器和草稿中继续保留结构化节点；发送快照使用可逆的普通文本标记携带 `data.text` 和恢复所需元数据，消息刷新后前端会重新恢复为 Mention。它不会进入 Mention 候选面板或结构化 Mention 元数据：

```ts
await window.MagicWidget?.setInput({
	blocks: [
		{ type: "text", text: "请解读 " },
		{
			type: "mention",
			mention: {
				type: "text",
				data: {
					id: "chart-mock-001",
					label: "销售趋势图",
					text: "图表 id: mock-chart; 时间范围: mock-range",
				},
			},
		},
	],
})
```

`sendMessage` 传入 content 时发送该内容且不替换当前编辑器值；省略 content 时执行编辑器对当前草稿的正常发送动作。结构化输入要求 SDK 与 iframe 使用相同协议版本部署。

### 新建对话

`newConversation` 会创建当前 Crew 的新话题；iframe 会在新话题切换完成后返回 response，SDK 以该 response 作为 Promise 的完成条件：

```js
await window.MagicWidget.newConversation()
await window.MagicWidget.setInput("新对话中的虚构内容")
await window.MagicWidget.sendMessage("发送新对话中的虚构内容")
```

宿主必须为容器设置非零宽高。内联模式不创建悬浮球、遮罩或 iframe 外层关闭按钮，`mount` 后默认展开；标准头部内的关闭按钮由 `config.window.closable` 控制，但 `close()` 始终可由宿主程序化调用。SDK 保持单例语义，后续 `mount` 会替换旧实例。

所有输入、发送、新建对话和配置更新方法均返回 Promise。失败时错误对象包含稳定的 `code`，例如 `NOT_MOUNTED`、`INVALID_INPUT`、`INVALID_CONFIG`、`IFRAME_NOT_READY` 或 `COMMAND_FAILED`。SDK 只在首次加载或重新加载期间等待 iframe 文档完成加载，不等待 `agent_ready`；命令结果以 iframe response 为准。

跨域通信使用版本化 `postMessage` 协议，并同时限制为 SDK 推导出的 Magic Origin 和当前 iframe 窗口。调用方不应传递密钥或完成任务不需要的业务数据。动态内容只在桌面 inline Widget 中生效，普通 Magic Web 页面和移动布局不会消费它。

### `config`

用于控制 SDK 嵌入页面的展示方式，不影响普通 Magic Web 页面：

```ts
namespace MagicWidget {
	type Layout = "desktop" | "mobile"

	interface WidgetConfig {
		layout?: Layout
		shell?: {
			appSidebar?: boolean
		}
		responsive?: {
			mobileDetection?: "viewport" | "device-and-viewport"
		}
		conversation?: {
			projectFiles?: boolean
			topicHistory?: boolean
			autoHire?: boolean
			previewMode?: "split" | "fullscreen" | "switchable"
		}
		header?: {
			visible?: boolean
			title?: string | { mode?: "static" | "hidden"; text?: string }
			topicName?: { mode?: "current" | "hidden" | "static"; text?: string }
			actions?: Partial<
				Record<
					"fullscreen" | "pin" | "newTopic" | "history" | "share" | "more" | "close",
					boolean
				>
			>
		}
		panel?: {
			projectFiles?: boolean
			uploadFiles?: boolean
			otherProjectFiles?: boolean
			digitalEmployees?: boolean
			microApps?: boolean
			workflows?: boolean
			connectors?: boolean
			skills?: boolean
			canvasElements?: boolean
			customGroups?: Array<{
				id: string
				label: string
				icon?: string
				iconUrl?: string
				items: Array<{
					id: string
					type: string
					text: string
					title?: string
					description?: string
					icon?: string
					iconUrl?: string
					data?: Record<string, unknown>
				}>
			}>
		}
		bottom?: {
			internetSearch?: { enabled?: boolean; buttonVisible?: boolean }
			plugin?: { enabled?: boolean; buttonVisible?: boolean }
			upload?: { enabled?: boolean; buttonVisible?: boolean }
			voice?: { enabled?: boolean; buttonVisible?: boolean }
			model?: { buttonVisible?: boolean }
		}
		window?: { closable?: boolean }
	}
}
```

| 字段                         | 作用                                                                                                                 | 边界限制                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`                     | 选择 Crew 对话内容使用桌面版或移动版。                                                                               | 不替换外围应用外壳；SDK 默认使用 `mobile`，可显式配置为 `desktop`。                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `shell.appSidebar`           | 显示或隐藏应用侧边栏。                                                                                               | 仅在合法 SDK 嵌入且最终 Crew 布局为 `desktop` 时生效，不影响移动端嵌入布局。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `responsive.mobileDetection` | 选择仅视口或设备与视口组合的移动端语义。                                                                             | SDK 默认使用 `viewport` 以兼容已有移动业务；需要窄 PC iframe 保持桌面交互时可配置为 `device-and-viewport`。                                                                                                                                                                                                                                                                                                                                                                                                            |
| `conversation.projectFiles`  | 显示或隐藏桌面版项目文件面板。                                                                                       | 仅由桌面版 Crew 对话布局消费。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `conversation.topicHistory`  | 启用或关闭桌面版历史话题入口和面板。                                                                                 | 仅由桌面版 Crew 对话布局消费。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `conversation.autoHire`      | 直开员工不可执行时是否自动尝试雇佣，默认开启。                                                                       | 仅在合法 SDK 嵌入中生效；普通 Magic Web Crew 页面不会自动雇佣。                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `conversation.previewMode`   | 选择 `split`、`fullscreen` 或 `switchable` 预览策略。                                                                | 桌面 SDK 嵌入默认 `switchable`；普通 Magic Web 页面继续使用现有并排布局。                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `header.visible`             | 显示或隐藏 inline 标准头部。                                                                                         | 仅桌面 inline 生效；隐藏后宿主可自行绘制头部。                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `header.title` / `topicName` | 配置头部上行标题和下行话题文案。                                                                                     | `title` 可以是字符串，或 `{ mode: "static", text }`。`title: { mode: "hidden" }` 只隐藏第一行，话题名和按钮保留，剩余话题名保持次要样式。省略 `title` 时使用默认标题；空白字符串会被拒绝。`hidden` 不接受 `text`，`static` 必须提供非空 `text`。`topicName.mode` 支持 `current`、`hidden`、`static`；默认使用当前话题名。 |
| `header.actions`             | 控制头部每个操作是否显示。                                                                                           | 未配置的操作保持显示；显式 `false` 隐藏。`fullscreen` 和 `pin` 没有组件内行为：要么注册对应的 `headerActions`，要么设为 `false`。只省略不注册仍会画出按钮，点击没有效果。`header.visible=false` 时整体不生效。                                                                                                                                                                                                                                                                                                         |
| `panel.*`                    | 分别控制 `@` 提及面板根层的当前项目文件、上传文件、其它项目/文件、数字员工、流程、微应用、连接器、技能和画布元素行。 | 每个字段只影响对应的 Mention 行；流程下的智能体和工具子行沿用现有行为。未配置保持当前行为。                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `bottom.*`                   | 分别控制联网搜索、连接器、上传、语音的能力和按钮，以及模型选择按钮。                                                 | 底部配置与 Mention 行相互独立。上传能力关闭会同步阻断拖拽/粘贴/图片；仅隐藏按钮仍保留能力。`internetSearch.enabled: false` 会隐藏按钮，并在发送时强制 `enable_web_search` 为 false。模型选择只有按钮显隐。                                                                                                                                                                                                                                                                                                             |
| `window.closable`            | 控制 iframe 标准头部内的关闭按钮是否显示。                                                                           | `false` 只隐藏入口，宿主仍可调用 `close()`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `panel.customGroups`         | 向桌面 inline Widget 的 `@` 面板末尾注入自定义命名分组。                                                             | `mount`/`updateConfig` 都是整体替换；分组 ID 不能重复或与内置入口冲突，同组子项 ID 不能重复，空分组不显示。最多 50 组、每组 1,000 条、所有分组合计 5,000 条、单条 32 KiB、整体 2 MiB（UTF-8 JSON）；`id`/`type`/`icon` 最多 64 字符，`label`/`text`/`title`/`description` 最多 512 字符。数量或字节超限会按顺序过滤并触发 `config.warning`，不会中断渲染；字段超长、结构非法、重复或非 JSON-safe 值返回带路径的 `INVALID_CONFIG` 并保留旧快照。保留的内置分组 ID 和两条 Mention 入口的边界对照见「Mention 设置边界」。 |

`split` 让展开的对话与预览并排展示；`fullscreen` 只在当前宿主控制的 Widget 容器内展示预览，退出时直接关闭预览；只有宿主同步放大 Widget 容器时，预览才会覆盖宿主视口；`switchable` 将预览保持在 Widget 内部布局中，新预览会话开始时自动收起对话，并允许用户展开或再次收起对话而不重建预览。用户仍可手动进入宿主全屏，退出后恢复进入前的对话布局。宿主控制器始终保持同一个 iframe 挂载，因此文件 Tab、工具回放状态、输入内容和已加载预览数据不会被重建。运行时更新配置只影响下一次预览激活，不会强制改变当前布局。

`updateConfig` 会校验传入的增量对象，并将声明字段合并到当前配置。iframe 已加载后，SDK 会通过受保护的消息通道发送合并后的完整快照；Magic Web 接受配置后 Promise 才会完成。运行时更新不会修改 URL、替换 `iframe.src` 或刷新 iframe：

```js
await window.MagicWidget.updateConfig({
	responsive: {
		mobileDetection: "device-and-viewport",
	},
	conversation: {
		projectFiles: true,
		topicHistory: false,
		autoHire: false,
		previewMode: "split",
	},
	header: { title: "自定义助手", topicName: { mode: "current" } },
	bottom: {
		upload: { enabled: false, buttonVisible: false },
		internetSearch: { enabled: true, buttonVisible: false },
	},
	window: { closable: false },
})
```

### Mention 设置边界

<!-- These limits mirror CUSTOM_MENTION_LIMITS in packages/magic-widget-sdk/src/config.ts and MAGIC_WIDGET_CUSTOM_GROUP_LIMITS in src/providers/MagicWidgetProvider/custom-groups.ts; keep every README copy of these numbers in sync. -->

Mention 有两条互不相通的设置入口，边界规则并不相同：`config.panel.customGroups` 决定 `@` 面板里的候选条目，`setInput` / `appendInput` / `sendMessage(content)` 的 `blocks[].mention` 直接把 Mention 节点写进编辑器。同名的 `text` 字段在两条入口上遵循不同上限，跨用前请先确认入口。

| 入口                        | 设置对象            | 生效范围             | 超限行为                                                                      | 失败错误码       |
| --------------------------- | ------------------- | -------------------- | ----------------------------------------------------------------------------- | ---------------- |
| `config.panel.customGroups` | `@` 面板候选项      | 仅桌面 inline Widget | 数量或字节超限按顺序过滤并触发 `config.warning`；字段超长或结构非法时整体拒绝 | `INVALID_CONFIG` |
| `blocks[].mention`          | 编辑器 Mention 节点 | 所有布局             | 无数量上限，也无字节上限                                                      | `INVALID_INPUT`  |

字段上限对照：

| 字段                                       | `config.panel.customGroups`                       | `blocks[].mention`                                                          |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `id` / `type`                              | 必填且非空，最多 64 字符                          | 无长度限制                                                                  |
| `icon`                                     | 可选 TSIcon token，最多 64 字符                   | 无长度限制                                                                  |
| `iconUrl`                                  | 可选 HTTPS 图片地址，最多 2,048 字符              | 无长度限制                                                                  |
| `placement`                                | 可选 `"start"` 或 `"end"`（默认 `"end"`）；`"start"` 将分组排在内置分类之前 | 无此配置                                                                    |
| `label` / `text` / `title` / `description` | `text` 必填且非空，各最多 512 字符                | `type: "text"` 时要求 `data.id`、`data.label`、`data.text` 非空，无长度限制 |
| 条目数量                                   | 最多 50 组、每组 1,000 条、合计 5,000 条          | `blocks` 数量无上限                                                         |
| 数据体积                                   | 单条最多 32 KiB、完整快照最多 2 MiB（UTF-8 JSON） | 无字节预算，仅要求可跨窗口结构化克隆                                        |

字段上限对照：

| 类别       | 触发条件                                                                                                                          | 表现                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 按顺序过滤 | 超过 50 组、每组 1,000 条、合计 5,000 条、单条 32 KiB 或整体 2 MiB                                                                | 保留能放下的前序内容，触发一次聚合 `config.warning`（`reasons` 为 `MAX_GROUPS`、`MAX_ITEMS_PER_GROUP`、`MAX_TOTAL_ITEMS`、`MAX_ITEM_BYTES` 或 `MAX_PAYLOAD_BYTES`），`mount` / `updateConfig` 正常返回，不刷新 iframe |
| 整体拒绝   | 字段缺失或为空、字段超过 64 / 512 字符、分组 ID 或组内条目 ID 重复、分组 ID 命中内置入口、出现未知字段、非纯对象或非 JSON-safe 值 | 返回带路径的 `INVALID_CONFIG`，保留旧快照且不做部分替换                                                                                                                                                               |
| 发送降级   | 用户点击自定义分组条目产生的 `text` Mention                                                                                       | 不进入 `extra.super_agent.mentions`，后端按 `@<item.text>` 纯文本写入 Agent prompt，附加 JSON 只是富文本元数据                                                                                                        |

以下内置入口 ID 为保留值，`config.panel.customGroups` 的分组 ID 不能与其重复：

```
personal-drive
enterprise-drive
organization-drive
project-files
other-project-files
mcp-extensions
digital-employees
flows
agents
micro-apps
skills
tools
upload-files
canvas-elements
histories
tabs
```

字段语义和宿主接入示例见下方「自定义 Mention 分组」，`config.warning` 的订阅方式见「事件 API」。

### 自定义 Mention 分组

自定义 Mention 分组会在 `config_ready` 握手后发送，因此不会进入受保护的首帧 URL query。桌面 inline Widget 会把非空分组展示在根列表中。默认情况下（或指定 `placement: "end"`），自定义分组排在系统内置 `@` 入口之后；若指定 `placement: "start"`，则将该自定义分组排在系统内置分类（微应用、连接器、技能等）之前。用户点击条目后会立即插入 `text` Mention 并关闭 Mention 面板；Mention 使用简短 `title` 展示（未提供时回退到 `text`），Agent prompt 使用完整 `text`。分组 ID、子项 ID、类型和数据保留在富文本 Mention 元数据中，不增加后端 Mention 协议字段。

首屏列表和进入分组始终使用静态 `panel.customGroups`。用户输入非空搜索词后，可通过可选的 `customMentionSearch` 回调返回动态候选。回调的 `scope` 为 `{ type: "global" }` 或 `{ type: "group", groupId }`，每个返回结果都必须带所属静态分组的 `groupId`。静态自定义结果和回调结果会合并展示，并使用 `groupId + item.id` 去重；同一身份同时存在时，以回调结果为准。全局搜索再将合并后的自定义结果与内置 Mention 合并；清空搜索词后恢复静态列表。

搜索请求的生命周期由 Widget 负责，宿主不需要自己实现请求时序控制。输入会经过防抖；开始新的搜索、替换分组或回调配置、以及卸载 Widget 时，都会通过 `signal` 中止正在执行的回调。被取消的回调不会影响面板：取消后迟到的结果会被丢弃，因此较早的慢响应无法覆盖最新的结果；取消也不会被渲染成失败态，面板会保留已经展示的结果。宿主只需要把 `signal` 透传给自己的数据请求，让底层请求尽早停止：

```js
customMentionSearch: async ({ query, scope, signal }) => {
	const response = await fetch(`/host-search?q=${encodeURIComponent(query)}`, { signal })
	const items = await response.json()
	return [{ groupId: scope.type === "group" ? scope.groupId : "business-charts", items }]
}
```

透传 `signal` 是推荐做法而非强制要求：宿主即使忽略它，自身的请求会继续执行，但 Widget 仍然会丢弃该结果。被取消的回调不能把取消回报成其他错误（例如超时或网络异常），因为不带 `AbortError` 的失败会被当作真实失败，并展示重试状态。

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		layout: "desktop",
		panel: {
			customGroups: [
				{
					id: "business-charts",
					label: "业务图表",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							title: "图表A",
							text: "静态图表示例",
						},
					],
				},
			],
		},
	},
	customMentionSearch: async ({ query, scope, signal }) => {
		const response = await fetch(`/host-search?q=${encodeURIComponent(query)}`, { signal })
		const items = await response.json()
		return [{ groupId: scope.type === "group" ? scope.groupId : "business-charts", items }]
	},
})
```

`text` 必须是自包含文本：它是当前 Agent 唯一能够稳定消费的条目语义。业务方应把业务对象名称以及分析所需的关键事实写入 `text`。`title` 用作列表和 Mention 标签的短文案，`description` 只用于列表展示，`data` 保留在富文本 Mention 元数据中用于展示和恢复；这些字段不会进入 `extra.super_agent.mentions`，也不会自动成为 Agent 可读取的结构化上下文。

```js
// 推荐：用户继续输入“解读它”时，Agent 已获得必要的示例背景。
text: "业务图表「图表A」；时间范围：示例季度；指标：模拟营收；趋势：环比增长12%；请分析主要变化。"

// 不推荐：Agent 只会收到含义不完整的名称，无法推断图表数据。
text: "图表A"
```

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		layout: "desktop",
		panel: {
			customGroups: [
				{
					id: "business-charts",
					label: "业务图表",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							text: "业务图表「图表A」；时间范围：示例季度；指标：模拟营收；趋势：环比增长12%；请分析主要变化。",
							title: "图表A",
							data: { source: "fixture" },
						},
					],
				},
			],
		},
	},
})

await window.MagicWidget.updateConfig({
	panel: {
		customGroups: [
			{
				id: "business-charts",
				label: "业务图表",
				items: [
					{
						id: "fixture-chart-b",
						type: "chart",
						text: "业务图表「图表B」；时间范围：示例月份；指标：模拟活跃用户；趋势：环比下降8%；请分析可能原因。",
						title: "图表B",
					},
				],
			},
		],
	},
})
```

#### 发送时携带的信息

用户点击条目后，编辑器会立即插入一个 `text` Mention。例如宿主配置：

```js
{
	id: "chart-a",
	type: "chart",
	text: "业务图表「图表A」；时间范围：示例季度；指标：模拟营收；趋势：环比增长12%；请分析主要变化。",
	title: "图表A",
	data: { source: "host", metric: "revenue" },
}
```

Magic Web 发送的富文本消息中会包含等价的 Mention 节点：

```js
{
	type: "mention",
	attrs: {
		type: "text",
		label: "业务图表「图表A」；时间范围：示例季度；指标：模拟营收；趋势：环比增长12%；请分析主要变化。",
		data: {
			source: "host",
			metric: "revenue",
			groupId: "business-charts",
			id: "chart-a",
			label: "图表A",
			text: "业务图表「图表A」；时间范围：示例季度；指标：模拟营收；趋势：环比增长12%；请分析主要变化。",
			type: "chart",
		},
	},
}
```

`groupId`、`id`、`label`、`text` 和原始条目 `type` 是 Widget 生成的保留字段，会覆盖条目 `data` 中的同名字段；`label` 取去除首尾空白后的 `title`，未提供或为空时回退到 `text`。其他 JSON-safe `data` 会保留在富文本 payload 中，用于编辑器展示和历史恢复。`title`、`description`、`icon` 不会以原字段名复制到 Mention data，除非宿主也将其放入 `data`。

该 Mention 会被明确排除在 `extra.super_agent.mentions` 之外，不会作为 `chart` 等新的后端结构化 Mention 类型发送。后端会将它以 `@<item.text>` 的纯文本形式写入 Agent prompt；附加 JSON 只是富文本元数据，在后端协议明确支持前，宿主不能依赖 Agent 将其作为结构化上下文读取。

`icon` 只作为本地图标安全 token 使用，Widget 不会加载条目提供的任意 URL。`text`、描述或 `data` 中的 HTML/script 字符串只按文本展示。数量和字节超限会使用过滤后的完整快照；结构非法的更新不会部分替换旧列表，也不会刷新 iframe。

`headerActions` 在 inline 头部原有行为完成之后通知宿主，回调不能取消该行为。`newTopic` 在话题创建成功后上报，`share`、`history`、`more` 在对应界面触发后上报。`fullscreen` 和 `pin` 没有组件内行为，回调会直接执行。`headerActionHandled: false` 只是所有权回执，iframe 不会回退。没有 handler 的宿主动作必须隐藏。下面的示例实现了 `pin` 和 `close`，因此把 `fullscreen` 设为 `false`。`close` 会先关闭 Widget，再执行 `headerActions.close`；回调失败不会把 Widget 重新打开：

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		header: {
			actions: {
				fullscreen: false,
			},
		},
	},
	headerActions: {
		pin: async ({ topicId }) => {
			await hostWindowApi.pinAgent({ topicId })
		},
		close: async ({ topicId }) => {
			await hostWindowApi.afterCloseAgent({ topicId })
		},
	},
})
```

`layout` 决定 Crew 使用哪套展示布局，`responsive.mobileDetection` 决定 Magic Web 现有组件使用的设备交互语义。SDK 默认采用 `layout: "mobile"` 和 `mobileDetection: "viewport"`，以保持已有移动业务的布局与交互行为。需要桌面布局或希望窄尺寸 PC iframe 保持桌面交互时，应显式配置 `layout: "desktop"` 或 `mobileDetection: "device-and-viewport"`。设备判断直接复用 Magic Web `utils/devices.ts` 中已有的 `isMobile` 结果。

初始配置会写入 SDK 自有的受保护 query，以便 iframe 首屏直接使用正确布局，避免错误布局闪现。只有真实 SDK iframe 且受保护的嵌入元数据匹配时，这份配置才会生效。

### `page`

必填。用于选择 SDK 允许打开的 Magic Web 页面。SDK 不接受自由 URL，也不接受自由路由字符串。

```ts
namespace MagicWidget {
	type PageOptions = CrewPageOptions

	interface CrewPageOptions {
		type: "crew"
		crewId: string
	}
}
```

| 页面类型 | 必填字段 | 结果                         |
| -------- | -------- | ---------------------------- |
| `crew`   | `crewId` | 打开指定 Crew 的专属会话页。 |

边界限制：

| 值                                     | 是否支持 | 结果                             |
| -------------------------------------- | -------- | -------------------------------- |
| `{ type: "crew", crewId: "crew-001" }` | 支持     | 在脚本域名下打开 Crew 页面。     |
| `{ type: "crew", crewId: "" }`         | 不支持   | 空 Crew ID 会被拒绝。            |
| `{ type: "freeform", ... }`            | 不支持   | 非公开页面类型会被类型约束拒绝。 |
| `route` / `url`                        | 不支持   | 自由导航不属于公开 API。         |

当前 `page.type = "crew"` 会解析到 `/{clusterCode}/super/crew/{crewId}`。未传部署码时使用 SaaS 路由 `/global/super/crew/{crewId}`；传入 `auth.deploymentCode` 时使用对应私有化路由。

### `auth`

```ts
namespace MagicWidget {
	interface AuthOptions {
		loginStrategy?: LoginStrategy
		deploymentCode?: string
		organizationCode?: string
	}
}
```

`loginStrategy` 会作为 `login-strategy` 查询参数追加到 iframe URL 中。Magic Web 可以在 `/login` 路由下依据该值选择对应的登录表单。

`deploymentCode` 用于进入数字员工页之前选择登录环境。未传或传入空字符串时使用 SaaS 环境；传入非空值时使用对应私有化环境。若该环境尚未登录，Magic Web 会复用现有登录入口并填充部署码；若浏览器中已有该环境账号，则复用现有账号切换能力。

当需要展示私有化部署识别码表单时，请同时传入 `loginStrategy: "private_deployment"` 和 `deploymentCode`。目标页仍使用 `/{deploymentCode}/...` 路由，因此已有私有化登录会话不会被 SaaS 权限校验拦截；若需要登录，同一部署码会传递给表单作为预填值。`privateDeploymentCode` 不再支持。

`organizationCode` 会作为 `organizationCode` 查询参数追加到 iframe URL 中。用户完成登录后，Magic Web 可以依据该值切换到目标 Magic 组织后再渲染页面。空字符串会被忽略。

环境选择发生在登录和 Crew 页面渲染之前，组织切换发生在目标环境登录完成之后。组织只会在目标部署环境的账号范围内匹配，不会跨环境选择同编码组织。本版本不提供额外的鉴权状态事件。

内置登录策略枚举：

```ts
namespace MagicWidget {
	type LoginStrategy =
		| "phone_captcha"
		| "email"
		| "phone_password"
		| "DingTalk"
		| "DingTalkAvoid"
		| "wecom"
		| "Lark"
		| "wechat_official_account"
		| "redirect"
		| "private_deployment"
		| "apple_login"
		| "google_login"
		| "anta_login"
		| string
}
```

如果 `iframe.query` 中也传入了 `login-strategy` 或 `organizationCode`，以 `auth` 中对应字段为准。

### `iframe`

```ts
namespace MagicWidget {
	interface IframeOptions {
		allow?: string
		sandbox?: string
		query?: Record<string, QueryValue>
	}

	type QueryValue =
		| string
		| number
		| boolean
		| null
		| undefined
		| Array<string | number | boolean | null | undefined>
}
```

| 参数      | 作用                             | 边界限制                                                                                                               |
| --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `allow`   | 设置 iframe 的 `allow` 属性。    | 使用浏览器标准权限策略语法，例如 `"clipboard-read; clipboard-write"`。                                                 |
| `sandbox` | 设置 iframe 的 `sandbox` 属性。  | 不传时不会设置 `sandbox`。过于严格的 sandbox 可能导致 Magic Web 功能不可用，因此只建议在宿主页面有明确安全要求时配置。 |
| `query`   | 向 iframe URL 追加额外查询参数。 | `null` 和 `undefined` 会被忽略。数组值会以同一个 key 追加多次。                                                        |

对于 SDK 自有查询参数，例如 `auth.organizationCode` 对应的 `organizationCode`、`auth.loginStrategy` 对应的 `login-strategy`，以及受保护的 Widget 初始配置 query，配置优先级高于 `iframe.query` 中的同名字段。

### `modal`

```ts
namespace MagicWidget {
	interface ModalOptions {
		title?: string
		width?: number | string
		height?: number | string
		classNames?: Partial<Record<ModalSlot, string>>
		styles?: Partial<Record<ModalSlot, Record<string, string | number | null | undefined>>>
	}
}
```

| 参数         | 作用                                                                     | 默认值 / 边界限制                                                                               |
| ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `title`      | 面板头部标题。该值也会作为 iframe 的 `title`。                           | 默认值为 `"Magic"`。                                                                            |
| `width`      | PC 端面板宽度。传入 number 时按 px 处理；传入 string 时按 CSS 尺寸处理。 | 默认值为 `min(420px, calc(100vw - 32px))`。移动端忽略该配置。                                   |
| `height`     | PC 端面板高度。传入 number 时按 px 处理；传入 string 时按 CSS 尺寸处理。 | 默认值为 `min(680px, calc(100vh - 32px))`。PC 端面板内置最小高度为 `420px`。移动端忽略该配置。  |
| `classNames` | 给指定 modal 插槽追加 className。                                        | 只负责追加 class 属性；如果需要稳定修改视觉样式，优先使用 `styles`。                            |
| `styles`     | 给指定 modal 插槽设置内联样式。                                          | 支持 camelCase CSS 属性、kebab-case CSS 属性和 CSS 自定义属性。`null` 与 `undefined` 会被忽略。 |

可配置的 modal 插槽：

| 插槽        | 对应区域               |
| ----------- | ---------------------- |
| `root`      | Widget 根容器。        |
| `layer`     | 全屏面板层。           |
| `mask`      | 移动端面板背后的蒙层。 |
| `container` | 面板容器。             |
| `header`    | 面板头部。             |
| `title`     | 头部标题文本。         |
| `close`     | 关闭按钮。             |
| `body`      | iframe 外层内容区域。  |
| `iframe`    | 内嵌 iframe 元素。     |

示例：

```js
window.MagicWidget.mount({
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	modal: {
		title: "Support",
		classNames: {
			container: "partner-widget-panel",
			header: "partner-widget-header",
		},
		styles: {
			mask: {
				backgroundColor: "rgba(15, 23, 42, 0.42)",
			},
			container: {
				boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
			},
			close: {
				color: "#334155",
			},
			iframe: {
				backgroundColor: "#ffffff",
			},
		},
	},
})
```

## 交互行为

| 环境               | 行为                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PC 端              | 页面展示圆形悬浮消息按钮。点击后按钮隐藏，并以按钮区域作为锚点重叠打开面板。面板可通过头部拖拽，并会在窗口尺寸变化时保持在视口内。              |
| 移动端，`<= 640px` | 面板以底部 popover 形式打开，并展示蒙层；宽度固定 `100%`，高度固定 `86vh`，底部无圆角。`modal.width` 与 `modal.height` 不生效，面板不支持拖拽。 |

悬浮按钮和面板是互斥显示的：同一时刻只会出现其中一个。面板可以通过右上角关闭按钮、移动端蒙层、键盘 `Escape`，或 `window.MagicWidget.close()` 关闭。

## 不支持的 Mount 参数

以下字段不属于对外公开 API，请不要传入 `mount`：

```ts
appOrigin
clusterCode
organizationCode
route
trigger
url
zIndex
```

请通过脚本地址选择 Magic Web 域名，通过 `page` 选择受支持的目标页面，通过 `auth.deploymentCode` 选择 SaaS 或私有化环境；如需预填私有化登录表单，请结合 `auth.loginStrategy: "private_deployment"` 使用，且不会改变私有化目标路由；通过 `auth.organizationCode` 配置登录后的组织切换，并通过 `modal` 参数配置面板展示效果。
