# HTML 微应用 window.Magic API 使用指南

本文档说明如何在 SuperMagic 的 HTML 微应用中调用 `window.Magic.*` 系列 API，涵盖文件读写（`fs`）和大模型调用（`llm`）两大类能力。

---

## 重要约束

1. 这些 API 仅在 SuperMagic workspace 中打开的 HTML 文件里有效，无需引入任何外部脚本。
2. 所有文件路径以 **应用根目录**（`index.html` 所在目录）为基准，禁止使用 `../` 穿越到上级目录。
3. `window.Magic.llm` 的 token 由宿主托管，HTML 内无法直接获取 `api_key`；直接调用方法即可。
4. 文件写入后，若需要让 Agent 感知到数据变化，调用 `window.Magic.setInputMessage()` 通知 Agent。

---

## 一、文件系统 API（`window.Magic.fs`）

### 1.1 读取文件 `readFile(path)`

```javascript
// 读取同目录下的 JSON 数据文件
const raw = await window.Magic.fs.readFile("data/users.json")
const users = JSON.parse(raw)

// 读取文本文件
const markdown = await window.Magic.fs.readFile("README.md")
```

**参数**：`path: string` — 相对于应用根目录的路径（如 `"data/orders.json"`）。  
**返回**：`Promise<string>` — 文件的文本内容。  
**限制**：单文件最大 5 MB；不存在则 reject。

---

### 1.2 写入文件 `writeFile(path, content)`

```javascript
// 写入 JSON 数据（文件不存在时自动创建）
const updated = { ...users, lastModified: Date.now() }
await window.Magic.fs.writeFile("data/users.json", JSON.stringify(updated, null, 2))

// 写入纯文本（使用 ./ 前缀明确表示相对路径，效果相同）
await window.Magic.fs.writeFile("./output/report.md", markdownContent)

// 写入大文件：直接传 Blob 或 ArrayBuffer（无需转字符串，支持二进制，上限 500 MB）
const response = await fetch("https://example.com/large-data.bin")
const blob = await response.blob()
await window.Magic.fs.writeFile("data/large-data.bin", blob)

// 使用 ArrayBuffer
const buffer = await response.arrayBuffer()
await window.Magic.fs.writeFile("data/large-data.bin", buffer)
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 相对于应用根目录的路径（支持 `"dir/file.txt"` 或 `"./dir/file.txt"`） |
| `content` | `string \| Blob \| ArrayBuffer` | 文件内容 |

**返回**：`Promise<void>`。  
**限制**：

- `string` 内容：最大 5 MB
- `Blob` / `ArrayBuffer` 内容：最大 500 MB（通过 postMessage 结构化克隆直接传输，无额外编码开销）

**说明**：文件已存在时覆盖；路径中的目录无需提前创建；禁止 `../` 穿越到应用根目录之外。

---

### 1.3 列出目录文件 `listFiles(dir?)`

```javascript
// 列出应用根目录下的文件（不递归）
const rootFiles = await window.Magic.fs.listFiles()
// → ["index.html", "README.md"]

// 列出子目录下的文件
const dataFiles = await window.Magic.fs.listFiles("data/")
// → ["users.json", "orders.json", "products.json"]
```

**参数**：`dir?: string` — 目录路径，默认为 `"./"`（应用根目录）。  
**返回**：`Promise<string[]>` — 文件名列表（不含路径前缀）。

---

### 1.4 监听文件变更 `watchFile(path, callback)`

```javascript
// 监听 AI Agent 对数据文件的更新
const unwatch = window.Magic.fs.watchFile("data/orders.json", async (event) => {
	console.log("文件已更新：", event.path, event.timestamp)
	const fresh = JSON.parse(await window.Magic.fs.readFile("data/orders.json"))
	renderTable(fresh)
})

// 停止监听（例如组件卸载时）
// unwatch()
```

**参数**：`path: string`, `callback: (e: { path: string; timestamp: number }) => void`。  
**返回**：`() => void` — 调用即停止监听。  
**说明**：主站采用轮询（约 3 秒一次），感知 `updated_at` 变化后推送通知；每个应用最多同时监听 10 个路径。

---

### 1.5 并发读取（推荐）

```javascript
const [users, orders, settings] = await Promise.all([
	window.Magic.fs.readFile("data/users.json").then(JSON.parse),
	window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
	window.Magic.fs.readFile("config/settings.json").then(JSON.parse),
])
```

---

## 二、大模型 API（`window.Magic.llm`）

### 2.1 获取可用模型列表 `getModels()`

```javascript
const models = await window.Magic.llm.getModels()
// → [{ id: "gpt-4o", object: "model", owned_by: "openai" }, ...]

const modelIds = models.map((m) => m.id)
console.log("可用模型：", modelIds)
```

**返回**：`Promise<Array<{ id: string; object?: string; owned_by?: string }>>` — 当前可用的模型列表。

---

### 2.2 单次对话 `chat(messages, options?)`

```javascript
// 基础用法
const reply = await window.Magic.llm.chat([
	{ role: "user", content: "用一句话总结：太阳系有几颗行星？" },
])
document.getElementById("result").textContent = reply

// 携带历史上下文
const reply2 = await window.Magic.llm.chat([
	{ role: "system", content: "你是一位数据分析专家，请用简洁的中文回答。" },
	{ role: "user", content: "上个月销售额同比增长了 15%，这意味着什么？" },
])

// 指定模型和参数
const reply3 = await window.Magic.llm.chat(
	[{ role: "user", content: "写一首关于秋天的五言绝句。" }],
	{ model: "gpt-4o", temperature: 0.9, maxTokens: 200 },
)
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | `Array<{ role: "user"\|"assistant"\|"system", content: string }>` | 对话消息列表 |
| `options.model` | `string?` | 指定模型 ID（不传则使用默认） |
| `options.temperature` | `number?` | 温度（0~2，越高越随机） |
| `options.maxTokens` | `number?` | 最大输出 token 数 |
| `options.systemPrompt` | `string?` | 等价于在消息列表首部插入 `system` 消息 |

**返回**：`Promise<string>` — 模型的回复内容（纯文本）。  
**超时**：120 秒无响应自动 reject。

---

### 2.3 流式对话 `stream(messages, onChunk, options?)`

逐 token 接收响应，适合长文本生成场景，用户能看到实时输出。

```javascript
let fullText = ""
const outputEl = document.getElementById("output")

const cancel = window.Magic.llm.stream(
	[{ role: "user", content: "请写一篇关于人工智能发展的 500 字文章。" }],
	(delta, done) => {
		fullText += delta
		outputEl.textContent = fullText
		if (done) {
			console.log("生成完成，共", fullText.length, "字")
		}
	},
	{ model: "gpt-4o", maxTokens: 1000 },
)

// 用户点击"取消"按钮时停止
document.getElementById("cancel-btn").onclick = () => cancel()
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | 同 `chat()` | 对话消息列表 |
| `onChunk` | `(delta: string, done: boolean) => void` | 每个 token 调用一次，`done=true` 表示结束 |
| `options` | 同 `chat()` | 可选参数 |

**返回**：`() => void` — 取消函数，调用后立即停止接收。

---

## 三、Agent 交互 API

### 3.1 向 Agent 发消息 `setInputMessage(msg)`

将消息填入输入框并自动发送，触发 Agent 继续执行。

```javascript
// 数据处理完成后通知 Agent
await window.Magic.fs.writeFile("output/analysis.json", JSON.stringify(result))
window.Magic.setInputMessage("数据分析已完成，请根据 output/analysis.json 生成可视化图表")
```

### 3.2 触发刷新 `reload()`

通知 Agent 刷新或重新执行当前任务。

```javascript
window.Magic.reload()
```

---

## 四、Agent 命名空间（`window.Magic.agent`）

### 4.1 获取员工列表 `getAgents()`

获取当前可用的 Agent（员工）列表。

```javascript
const agents = await window.Magic.agent.getAgents()
// → [
//   { id: "general", name: "通用助手", icon: "https://...", color: "#4A90D9", type: "official" },
//   { id: "data_analysis", name: "数据分析师", icon: "https://...", color: "#52C41A", type: "official" },
//   { id: "my_custom_agent", name: "我的自定义员工", icon: "https://...", color: "#FF6B6B", type: "custom" },
// ]

// 展示可选员工列表
agents.forEach((agent) => {
	console.log(`${agent.name} (${agent.type}) - ${agent.id}`)
})
```

**返回**：`Promise<Array<{ id: string; name: string; icon: string; color: string; type: "official" | "custom" | "public" }>>` — 当前可用的员工列表。

| 字段    | 类型     | 说明                                               |
| ------- | -------- | -------------------------------------------------- |
| `id`    | `string` | Agent 唯一标识（mode.identifier）                  |
| `name`  | `string` | Agent 名称                                         |
| `icon`  | `string` | Agent 图标 URL                                     |
| `color` | `string` | Agent 图标颜色                                     |
| `type`  | `string` | Agent 类型：`"official"` / `"custom"` / `"public"` |

---

## 五、项目命名空间（`window.Magic.project`）

### 5.1 上传文件到工作区 `uploadFiles(files)`

> **推荐**：对于应用根目录内的文件写入，优先使用 `window.Magic.fs.writeFile(path, blob)`。
> 它更简洁（无需构造数组）、支持 500 MB、且自动创建目录。
> `uploadFiles` 适用于需要批量上传多个文件、或需要自定义目标路径的场景。

```javascript
// ✅ 推荐：直接用 writeFile 写入单个文件
const input = document.createElement("input")
input.type = "file"
input.onchange = async () => {
	const file = input.files[0]
	await window.Magic.fs.writeFile(file.name, file)
}
input.click()

// 批量上传多个文件时使用 uploadFiles
const input2 = document.createElement("input")
input2.type = "file"
input2.multiple = true
input2.onchange = async () => {
	await window.Magic.project.uploadFiles(
		Array.from(input2.files).map((f) => ({
			file: f,
			path: `./${f.name}`,
			filename: f.name,
		})),
	)
}
input2.click()
```

**参数**：`files: Array<{ file: File, path: string, filename: string }>` — 每项包含 File 对象、目标路径和文件名。  
**返回**：`Promise<unknown>`。  
**限制**：单文件最大 500 MB。

### 5.2 下载 workspace 文件 `downloadFiles(paths)`

```javascript
// 下载 workspace 中指定路径的文件到本地
await window.Magic.project.downloadFiles(["output/report.pdf", "data/export.csv"])
```

### 5.3 将文件附加到消息输入框 `addFilesToMessage(filePaths, agentMode?)`

```javascript
// 将工作区文件附加到输入框
await window.Magic.project.addFilesToMessage(["data/report.csv", "output/chart.png"])
```

### 5.4 新建话题并发送消息 `createTopicAndSend(message, options?)`

创建一个新话题，并在该话题中发送指定消息，可选指定员工和模型。
`message` 支持纯文本字符串或 tiptap JSON 文档结构（可内联 `@` mention 等富文本节点）。

```javascript
// 基础用法：创建新话题并发送纯文本消息
const { topicId } = await window.Magic.project.createTopicAndSend("请帮我分析这组数据")

// 指定员工发送
const { topicId: tid2 } = await window.Magic.project.createTopicAndSend(
	"请用 Python 写一个爬虫脚本",
	{
		agentId: "general",
	},
)

// 指定员工 + 模型
const { topicId: tid3 } = await window.Magic.project.createTopicAndSend("请为我生成一份报告", {
	agentId: "data_analysis",
	model: "gpt-4o",
})

// 发送带 @文件引用 的富文本消息（tiptap JSON）
const { topicId: tid4 } = await window.Magic.project.createTopicAndSend({
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "请根据 " },
				{
					type: "mention",
					attrs: {
						type: "project_file",
						data: {
							file_id: "file_abc123",
							file_name: "report.csv",
							file_path: "data/report.csv",
							file_extension: "csv",
						},
					},
				},
				{ type: "text", text: " 生成可视化图表" },
			],
		},
	],
})
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `message` | `string \| TiptapJSONContent` | 纯文本消息或 tiptap JSON 文档（可包含 mention 节点） |
| `options.agentId` | `string?` | 指定 Agent ID（从 `getAgents()` 获取） |
| `options.model` | `string?` | 指定模型 ID |

**返回**：`Promise<{ topicId: string }>` — 新创建的话题 ID。  
**超时**：30 秒无响应自动 reject。

---

### 5.5 在当前话题发送消息 `sendMessage(message, options?)`

在当前激活的话题中直接发送一条消息，可选指定模型。
`message` 支持纯文本字符串或 tiptap JSON 文档结构（可内联 `@` mention 等富文本节点）。

```javascript
// 基础用法：直接发送纯文本消息
await window.Magic.project.sendMessage("请继续分析第二部分数据")

// 指定模型发送
await window.Magic.project.sendMessage("请用更详细的方式解释", { model: "gpt-4o" })

// 发送带 @文件引用 的富文本消息
await window.Magic.project.sendMessage({
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "请分析 " },
				{
					type: "mention",
					attrs: {
						type: "project_file",
						data: {
							file_id: "file_xyz789",
							file_name: "sales.csv",
							file_path: "data/sales.csv",
							file_extension: "csv",
						},
					},
				},
				{ type: "text", text: " 中的趋势" },
			],
		},
	],
})
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `message` | `string \| TiptapJSONContent` | 纯文本消息或 tiptap JSON 文档（可包含 mention 节点） |
| `options.model` | `string?` | 指定模型 ID |

**返回**：`Promise<void>`。  
**超时**：15 秒无响应自动 reject。

---

### 5.6 TiptapJSONContent 数据结构说明

`createTopicAndSend` 和 `sendMessage` 的 `message` 参数支持 tiptap JSON 格式，可内联 `@` mention 节点引用工作区文件。

#### 基本结构

```typescript
interface TiptapJSONContent {
	type: string // 节点类型，如 "doc", "paragraph", "text", "mention"
	attrs?: Record<string, unknown> // 节点属性
	content?: TiptapJSONContent[] // 子节点
	text?: string // 文本节点内容
}
```

#### Mention 节点格式

支持两种 mention 类型：`project_file`（文件）和 `project_directory`（目录）。

**文件 mention（`project_file`）：**

```javascript
{
  type: "mention",
  attrs: {
    type: "project_file",
    data: {
      file_id: "file_abc123",       // 文件唯一标识
      file_name: "report.csv",      // 文件名（含扩展名）
      file_path: "data/report.csv", // 相对路径（相对于工作区根目录）
      file_extension: "csv",        // 文件扩展名
      file_size: 1024,              // 可选，文件大小（字节）
    }
  }
}
```

**目录 mention（`project_directory`）：**

```javascript
{
  type: "mention",
  attrs: {
    type: "project_directory",
    data: {
      directory_id: "dir_456",      // 目录唯一标识
      directory_name: "docs",       // 目录名称
      directory_path: "docs",       // 相对路径（相对于工作区根目录）
      directory_metadata: {         // 目录元数据
        version: "1",
        type: "folder",
        name: "docs",
      }
    }
  }
}
```

#### 完整消息示例

```javascript
// 包含 @文件 和 @目录 引用的消息
await window.Magic.project.sendMessage({
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "请对比 " },
				{
					type: "mention",
					attrs: {
						type: "project_file",
						data: {
							file_id: "file_001",
							file_name: "sales_2024.csv",
							file_path: "data/sales_2024.csv",
							file_extension: "csv",
						},
					},
				},
				{ type: "text", text: " 和 " },
				{
					type: "mention",
					attrs: {
						type: "project_directory",
						data: {
							directory_id: "dir_002",
							directory_name: "reports",
							directory_path: "output/reports",
							directory_metadata: { type: "folder", name: "reports" },
						},
					},
				},
				{ type: "text", text: " 中的数据差异" },
			],
		},
	],
})
```

#### attrs 字段说明

**`project_file` data 字段：**

| 字段             | 类型     | 必填 | 说明                           |
| ---------------- | -------- | ---- | ------------------------------ |
| `file_id`        | `string` | 是   | 文件唯一标识                   |
| `file_name`      | `string` | 是   | 文件名（含扩展名）             |
| `file_path`      | `string` | 是   | 相对路径（相对于工作区根目录） |
| `file_extension` | `string` | 是   | 文件扩展名（不含 `.`）         |
| `file_size`      | `number` | 否   | 文件大小（字节）               |

**`project_directory` data 字段：**

| 字段                 | 类型     | 必填 | 说明                                          |
| -------------------- | -------- | ---- | --------------------------------------------- |
| `directory_id`       | `string` | 是   | 目录唯一标识                                  |
| `directory_name`     | `string` | 是   | 目录名称                                      |
| `directory_path`     | `string` | 是   | 相对路径（相对于工作区根目录）                |
| `directory_metadata` | `object` | 是   | 目录元数据（含 `version?`, `type?`, `name?`） |

## 六、向后兼容说明

以下旧路径仍然可用，但建议迁移到新的命名空间：

| 旧路径（deprecated）                          | 新路径                                                |
| --------------------------------------------- | ----------------------------------------------------- |
| `window.Magic.getAgents()`                    | `window.Magic.agent.getAgents()`                      |
| `window.Magic.uploadFiles(files)`             | `window.Magic.project.uploadFiles(files)`             |
| `window.Magic.downloadFiles(paths)`           | `window.Magic.project.downloadFiles(paths)`           |
| `window.Magic.addFilesToMessage(files)`       | `window.Magic.project.addFilesToMessage(files)`       |
| `window.Magic.createTopicAndSend(msg, opts?)` | `window.Magic.project.createTopicAndSend(msg, opts?)` |
| `window.Magic.sendMessage(msg, opts?)`        | `window.Magic.project.sendMessage(msg, opts?)`        |

---

## 七、完整示例

### 示例 A：读数据 → LLM 分析 → 写回结果 → 通知 Agent

```html
<!DOCTYPE html>
<html lang="zh">
	<head>
		<meta charset="UTF-8" />
		<title>数据分析助手</title>
	</head>
	<body>
		<button id="analyze">开始分析</button>
		<pre id="output">等待分析...</pre>

		<script>
			document.getElementById("analyze").onclick = async () => {
				const output = document.getElementById("output")
				output.textContent = "读取数据中..."

				// 1. 读取数据
				const [users, orders] = await Promise.all([
					window.Magic.fs.readFile("data/users.json").then(JSON.parse),
					window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
				])

				output.textContent = "调用 LLM 分析中..."

				// 2. 流式调用 LLM
				let analysis = ""
				await new Promise((resolve) => {
					window.Magic.llm.stream(
						[
							{
								role: "user",
								content: `请分析以下数据并给出业务建议：\n用户数：${users.length}\n订单总额：${orders.reduce((s, o) => s + o.amount, 0)}`,
							},
						],
						(delta, done) => {
							analysis += delta
							output.textContent = analysis
							if (done) resolve(null)
						},
						{ maxTokens: 500 },
					)
				})

				// 3. 写回分析结果
				await window.Magic.fs.writeFile("output/analysis.md", analysis)

				// 4. 通知 Agent
				window.Magic.setInputMessage("分析完成，结果已写入 output/analysis.md，请生成图表")
			}
		</script>
	</body>
</html>
```

---

### 示例 B：实时监听 Agent 写入的数据并自动刷新界面

```html
<!DOCTYPE html>
<html lang="zh">
	<head>
		<meta charset="UTF-8" />
		<title>实时数据看板</title>
	</head>
	<body>
		<div id="dashboard">加载中...</div>

		<script>
			async function render() {
				const data = JSON.parse(await window.Magic.fs.readFile("data/metrics.json"))
				document.getElementById("dashboard").innerHTML = `
        <h2>实时指标</h2>
        <p>总用户：${data.totalUsers}</p>
        <p>今日活跃：${data.dailyActive}</p>
        <p>更新时间：${new Date(data.updatedAt).toLocaleString()}</p>
      `
			}

			// 首次加载
			render().catch(console.error)

			// 监听 Agent 对数据文件的更新
			window.Magic.fs.watchFile("data/metrics.json", () => {
				render().catch(console.error)
			})
		</script>
	</body>
</html>
```

---

### 示例 C：让用户选择模型并流式对话

```html
<!DOCTYPE html>
<html lang="zh">
	<head>
		<meta charset="UTF-8" />
		<title>模型对话</title>
	</head>
	<body>
		<select id="model-select">
			<option>加载中...</option>
		</select>
		<textarea id="input" placeholder="输入消息..."></textarea>
		<button id="send">发送</button>
		<button id="cancel" disabled>取消</button>
		<div id="output"></div>

		<script>
			let cancelStream = null

			// 加载模型列表
			window.Magic.llm.getModels().then((models) => {
				const sel = document.getElementById("model-select")
				sel.innerHTML = models
					.map((m) => `<option value="${m.id}">${m.id}</option>`)
					.join("")
			})

			document.getElementById("send").onclick = async () => {
				const model = document.getElementById("model-select").value
				const content = document.getElementById("input").value.trim()
				if (!content) return

				const output = document.getElementById("output")
				output.textContent = ""
				document.getElementById("cancel").disabled = false

				cancelStream = window.Magic.llm.stream(
					[{ role: "user", content }],
					(delta, done) => {
						output.textContent += delta
						if (done) {
							document.getElementById("cancel").disabled = true
							cancelStream = null
						}
					},
					{ model },
				)
			}

			document.getElementById("cancel").onclick = () => {
				cancelStream?.()
				cancelStream = null
				document.getElementById("cancel").disabled = true
			}
		</script>
	</body>
</html>
```

---

## 八、错误处理最佳实践

```javascript
// fs 错误处理
try {
	const content = await window.Magic.fs.readFile("data/config.json")
	return JSON.parse(content)
} catch (err) {
	if (err.message.includes("not found")) {
		// 文件不存在，使用默认值
		return { theme: "light", lang: "zh" }
	}
	console.error("读取配置失败：", err)
	throw err
}

// llm 超时/失败处理
try {
	const reply = await window.Magic.llm.chat(messages, { maxTokens: 500 })
	return reply
} catch (err) {
	if (err.message.includes("timed out")) {
		return "请求超时，请重试。"
	}
	console.error("LLM 调用失败：", err)
	return "调用失败：" + err.message
}

// stream 错误：onChunk 以 done=true 通知结束（含出错情况）
window.Magic.llm.stream(messages, (delta, done) => {
	buffer += delta
	if (done) finalize(buffer)
})
```

---

## 九、API 速查表

| API                                                   | 说明                                                              | 返回                     |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `window.Magic.fs.readFile(path)`                      | 读取文件文本                                                      | `Promise<string>`        |
| `window.Magic.fs.writeFile(path, content)`            | 写入/创建文件（content 支持 string/Blob/ArrayBuffer，上限 500MB） | `Promise<void>`          |
| `window.Magic.fs.listFiles(dir?)`                     | 列出目录文件                                                      | `Promise<string[]>`      |
| `window.Magic.fs.watchFile(path, cb)`                 | 监听文件变更                                                      | `() => void`（取消函数） |
| `window.Magic.llm.getModels()`                        | 获取可用模型                                                      | `Promise<Model[]>`       |
| `window.Magic.llm.chat(msgs, opts?)`                  | 单次对话                                                          | `Promise<string>`        |
| `window.Magic.llm.stream(msgs, onChunk, opts?)`       | 流式对话                                                          | `() => void`（取消函数） |
| `window.Magic.setInputMessage(msg)`                   | 向 Agent 发消息                                                   | `void`                   |
| `window.Magic.reload()`                               | 触发 Agent 刷新                                                   | `void`                   |
| `window.Magic.agent.getAgents()`                      | 获取可用员工列表                                                  | `Promise<AgentInfo[]>`   |
| `window.Magic.project.uploadFiles(files)`             | 上传文件到工作区                                                  | `Promise<unknown>`       |
| `window.Magic.project.downloadFiles(paths)`           | 下载工作区文件                                                    | `Promise<unknown>`       |
| `window.Magic.project.addFilesToMessage(files)`       | 将文件附加到输入框                                                | `Promise<unknown>`       |
| `window.Magic.project.createTopicAndSend(msg, opts?)` | 新建话题并发送消息（msg 支持 string 或 tiptap JSON）              | `Promise<{ topicId }>`   |
| `window.Magic.project.sendMessage(msg, opts?)`        | 当前话题发送消息（msg 支持 string 或 tiptap JSON）                | `Promise<void>`          |
