# CanvasDesign 插件开发范式

## 1. 目标

这份文档描述 CanvasDesign 插件开发范式，定义插件作者应该如何组织插件包、运行时代码和视图生命周期。

核心目标：

1. `manifest.json` 作为插件静态配置的唯一来源。
2. `index.js` 只负责运行时行为，不重复声明展示信息。
3. runtime 可以在不执行插件 JS 的情况下完成插件列表、分类、入口、权限提示和资源校验。
4. 插件生命周期覆盖准备、渲染、状态更新、宿主状态变化、可见态切换和销毁。
5. `render` 不只是一次性挂载函数，而是创建并返回 view controller。
6. DOM 引用由 view controller 管理，避免在 `update` 中反复查找 DOM。
7. `version` 使用数字型 runtime 处理器版本，例如 `1` 对应 CanvasDesign 的 `runtime/v1`。

## 2. 核心模型

插件由四层组成：

```text
manifest.json
  静态声明：身份、runtime 版本、入口、样式、展示、多语言、能力

plugin module
  实例生命周期：create、prepare、render、dispose

plugin instance
  业务状态、任务句柄、缓存数据；不保存 DOM 引用

view controller
  DOM 引用、事件监听、局部 DOM patch、可见态、视图清理
```

这套范式刻意不把所有逻辑都包进 `setup()`。原因是不同阶段需要不同的 runtime 能力：

| 阶段      | 关心的问题                       | 适合的位置                         |
| --------- | -------------------------------- | ---------------------------------- |
| 静态发现  | 插件是谁、使用哪个 runtime、如何展示、需要什么能力 | `manifest.json`                    |
| 实例创建  | 插件运行时需要哪些业务状态         | `create(ctx)`                      |
| 数据准备  | 打开前需要预取什么数据             | `prepare(ctx, instance, scope)`    |
| UI 创建   | 创建哪些 DOM、绑定哪些事件         | `render(ctx, instance, root, scope)` |
| UI 更新   | 状态变化后如何局部刷新 DOM         | `view.update(change)`              |
| 可见态    | 面板显示、隐藏、切换时如何处理      | `view.activate/deactivate(scope)`  |
| 销毁      | 释放 UI 资源和实例资源             | `view.dispose(reason)` + `module.dispose(reason)` |

## 3. 插件包结构

```text
my-plugin/
├── manifest.json
├── index.js
├── index.css
└── assets/
```

分工：

| 文件            | 职责                                             |
| --------------- | ------------------------------------------------ |
| `manifest.json` | 插件身份、runtime 版本、展示信息、入口、样式、能力、多语言 |
| `index.js`      | 插件运行逻辑、生命周期、事件处理、生成请求构建       |
| `index.css`     | 插件 iframe 内样式                               |
| `assets/`       | 插件包内静态资源，可通过 `ctx.resources.resolve` 访问 |

插件作者不应该在 `index.js` 中重复写 `name`、`label`、`description`、`category`、`icon`、`capabilities` 等静态信息。这些都应该进入 `manifest.json`。

当前初始化阶段仍然可以由宿主消费 `props.plugins`。内置插件还是静态写在代码里没有问题，`manifest.json` 是插件包的设计形态；动态插件阶段再把 manifest 的读取来源从静态配置扩展到用户目录或远程插件包。

## 4. `manifest.json`

### 4.1 示例

```json
{
	"name": "virtual-tryon",
	"version": 1,
	"entry": "index.js",
	"styles": ["index.css"],
	"icon": "👗",
	"category": {
		"key": "model"
	},
	"label": "{{label}}",
	"description": "{{description}}",
	"capabilities": [
		"assets.pickFiles",
		"assets.uploadFile",
		"ai.getImageModels",
		"ai.generateAndPlace",
		"ai.completeImagePrompt",
		"ui.toast",
		"ui.close"
	],
	"locales": {
		"zh-CN": {
			"label": "万物上身",
			"description": "上传商品图，生成商业模特穿搭图。",
			"button.generate": "一键生成穿搭图",
			"toast.success": "生成成功"
		},
		"en-US": {
			"label": "Virtual Try-On",
			"description": "Upload product images to generate commercial try-on shots.",
			"button.generate": "Generate Try-On",
			"toast.success": "Generated"
		}
	}
}
```

### 4.2 基础字段

| 字段          | 必填 | 说明                                  |
| ------------- | ---- | ------------------------------------- |
| `name`        | 是   | 插件唯一标识，开发阶段用它作为插件身份 |
| `version`     | 是   | 数字型 runtime 处理器版本，当前为 `1` |
| `entry`       | 是   | 运行入口 JS，相对插件目录             |
| `styles`      | 否   | CSS 文件路径数组或字符串              |
| `icon`        | 否   | 单字符 emoji 或插件包内资源相对路径    |
| `category`    | 否   | 插件分类                              |
| `label`       | 是   | 展示名称，可使用 `{{key}}` 引用 locales |
| `description` | 是   | 插件描述，可使用 `{{key}}` 引用 locales |
| `locales`     | 是   | 多语言文案                            |

`version` 不是插件业务发布版本，也不是语义化版本号。它只表示插件需要 CanvasDesign 使用哪个 runtime 处理器加载：`1` 对应宿主侧 `PluginPanel/runtime/v1`。同一个 runtime 版本下的插件文案、提示词、UI 配置和普通功能迭代不需要修改 `version`。

插件刷新由开发工具或宿主显式触发，runtime 按 `manifest.name` 关闭当前实例并重新加载当前插件包。

### 4.3 `capabilities`

`capabilities` 声明插件需要使用的宿主能力：

```json
{
	"capabilities": [
		"assets.pickFiles",
		"assets.uploadFile",
		"ai.getImageModels",
		"ai.generateAndPlace",
		"ai.completeImagePrompt",
		"ui.toast"
	]
}
```

第一阶段它主要用于：

1. 静态校验：插件代码新增宿主能力调用时必须同步补充声明。
2. 插件详情展示：让使用者知道插件会使用哪些能力。
3. runtime 桥接收敛：未声明能力的 bridge 调用直接拒绝。

不建议第一阶段就做复杂权限弹窗。权限治理可以在插件市场或外部插件开放时再设计。

### 4.4 UI 入口暂不开放配置

第一阶段插件不通过 `manifest.json` 声明工具栏、面板、右键菜单或属性面板入口。CanvasDesign 统一把可运行插件放到当前画布插件入口中，并在宿主侧固定 iframe 面板的默认尺寸、最小高度和最大高度。

这样可以避免开发期过早暴露入口配置 API。等插件市场、多入口形态或第三方插件开放边界明确后，再重新设计入口配置字段。

## 5. 运行时协议

### 5.1 类型草案

```ts
interface PluginModule<TInstance = unknown> {
	create(ctx: PluginContext): TInstance
	prepare?(ctx: PluginContext, instance: TInstance, scope: PluginLifecycleScope): void | Promise<void>
	render(
		ctx: PluginContext,
		instance: TInstance,
		root: HTMLElement,
		scope: PluginLifecycleScope,
	): PluginViewController | void | Promise<PluginViewController | void>
	dispose?(ctx: PluginContext, instance: TInstance, reason: PluginDisposeReason): void | Promise<void>
}

interface PluginViewController {
	update?(change: PluginStateChange): void | Promise<void>
	onHostStateChange?(event: HostStateChange): void | Promise<void>
	activate?(scope: PluginLifecycleScope): void | Promise<void>
	deactivate?(scope: PluginLifecycleScope): void | Promise<void>
	dispose?(reason: PluginDisposeReason): void | Promise<void>
}

interface PluginLifecycleScope {
	signal: AbortSignal
	reason?: "open" | "close" | "reload" | "host-unmount" | "runtime-error"
}

type PluginDisposeReason = "close" | "reload" | "host-unmount" | "runtime-error"
```

`render` 返回的是 view controller，而不是一个普通 cleanup 函数。cleanup 是 view controller 的一部分，放在 `view.dispose(reason)` 中。

### 5.2 Hook 参数说明

`ctx / instance / root / scope` 是 module 生命周期的核心参数。它们的职责边界应该明确，否则插件代码很容易变成“到处都能做所有事”。

| 参数       | 来源                  | 生命周期范围                  | 说明                                  | 使用边界                              |
| ---------- | --------------------- | ----------------------------- | ------------------------------------- | ------------------------------------- |
| `ctx`      | runtime 创建并注入      | 当前插件实例生命周期内稳定      | 宿主状态属性和宿主能力方法的唯一入口     | 不暴露到全局，不直接修改 `ctx.host`     |
| `instance` | `create(ctx)` 返回值   | 从 `create` 到 `module.dispose` | 插件业务实例，保存 state、任务句柄、缓存 | 不保存 DOM refs，不访问宿主 DOM        |
| `root`     | runtime 在 `render` 提供 | 从 `render` 到 `view.dispose`   | iframe 内的插件 UI 挂载容器             | 只在 iframe 内操作，不跨到宿主页面      |
| `scope`    | runtime 为当前生命周期阶段创建 | 当前打开、激活、隐藏或关闭阶段   | 生命周期上下文，主要用于取消和关闭原因   | 异步任务应监听 `scope.signal`          |

各 hook 参数建议保持如下形态：

```ts
create(ctx)
prepare(ctx, instance, scope)
render(ctx, instance, root, scope)
view.update(change)
view.onHostStateChange(event)
view.activate(scope)
view.deactivate(scope)
view.dispose(reason)
module.dispose(ctx, instance, reason)
```

`view.update`、`view.onHostStateChange`、`view.activate`、`view.deactivate` 和 `view.dispose` 不再重复传 `ctx / instance / root`。这些方法由 `render` 返回，天然可以通过闭包访问 `ctx`、`instance`、`root` 和 DOM refs。

这样设计有三个好处：

1. DOM refs 可以留在 `render` 闭包里，不需要挂到 `instance.view`。
2. `update` 只表达“状态变化后如何更新视图”，不重新获得一堆全局能力。
3. `instance` 更像业务实例，`view controller` 更像 UI 实例，职责不会混在一起。

#### `ctx`

`ctx` 是插件和宿主之间的能力边界。它包含两类内容：

1. 状态属性，例如 `ctx.plugin`、`ctx.host.locale`、`ctx.host.accessMode`。
2. 能力方法，例如 `ctx.i18n.t`、`ctx.ui.toast`、`ctx.assets.pickFiles`、`ctx.ai.generateAndPlace`、`ctx.ai.completeImagePrompt`。

`ctx` 在一个插件实例生命周期内应保持引用稳定。宿主状态变化时，runtime 更新 `ctx.host` 的可读状态，并通过 `view.onHostStateChange(event)` 通知 view。

插件不应该把 `ctx` 存到全局变量里。reload 后已失效的 `ctx` 不应继续持有宿主能力。

#### `instance`

`instance` 是插件业务实例，由 `create(ctx)` 创建：

```js
create(ctx) {
	return {
		state: ctx.state.create({ loading: false }),
		abortController: null,
		modelCache: new Map(),
	}
}
```

`instance` 适合保存：

1. `instance.state`：插件 UI 会话态。
2. `AbortController`：上传、生成、轮询等任务句柄。
3. 业务缓存：模型列表、模板配置、资源索引。
4. 与 DOM 无关的 helper。

`instance` 不适合保存：

1. DOM 节点。
2. DOM 事件 handler。
3. iframe root。
4. 第三方 UI 组件实例。

这些内容应该放在 `render` 闭包和 `view controller` 中。

#### `root`

`root` 是 runtime 传给 `render` 的 iframe 内挂载容器：

```js
render(ctx, instance, root) {
	const panel = document.createElement("div")
	root.append(panel)

	return {
		dispose() {
			root.replaceChildren()
		},
	}
}
```

`root` 只在 `render` 和返回的 view controller 闭包内使用。插件不应该通过 `parent.document`、`window.top` 或宿主 DOM selector 去访问 CanvasDesign 页面。

如果 state 更新后要改 DOM，应通过 `view.update(change)` 使用闭包中的 DOM refs 做局部 patch，而不是重新获取 `root` 或重新创建整棵视图。

#### `scope`

`scope` 是 runtime 传入的生命周期上下文，至少包含 `AbortSignal`：

```ts
interface PluginLifecycleScope {
	signal: AbortSignal
	reason?: "open" | "close" | "reload" | "host-unmount" | "runtime-error"
}
```

典型用法：

```js
async prepare(ctx, instance, scope) {
	const models = await ctx.ai.getImageModels({ signal: scope.signal })
	if (scope.signal.aborted) return
	ctx.state.patch(instance.state, { models }, { silent: true })
}
```

`scope` 适合用于：

1. 取消 `prepare` 阶段的异步加载。
2. 取消 `activate` 后启动的预览、轮询或生成任务。
3. reload、close、host unmount 时让插件尽快停止 pending work。

`scope` 不等同于插件全局状态。插件如果要长期持有某个任务的取消句柄，应在 `instance` 里保存自己的 `AbortController`，并在 `view.deactivate` 或 `module.dispose` 中释放。

### 5.3 生命周期流转

```text
discovered
  ↓
manifest-loaded
  ↓
entry-loaded
  ↓
created
  ↓
prepared
  ↓
rendered
  ↓
active ↔ inactive
  ↓
disposing
  ↓
disposed
```

生命周期由 runtime 驱动，插件只实现对应 hook。插件不应该自己猜测宿主何时关闭、重载或隐藏，也不应该通过轮询判断宿主状态。

| 阶段              | runtime 职责                              | 插件 hook                  | 插件职责                         |
| ----------------- | ----------------------------------------- | -------------------------- | -------------------------------- |
| `discovered`      | 找到插件目录或内置插件配置                 | 无                         | 无                               |
| `manifest-loaded` | 读取并校验 `manifest.json`                | 无                         | 无                               |
| `entry-loaded`    | 加载 `entry`、注入 bootstrap 和 `ctx`      | 无                         | 调用 `registerMagicCanvasPlugin` |
| `created`         | 创建插件实例                              | `module.create(ctx)`       | 创建实例状态，不操作 DOM         |
| `prepared`        | 挂载前准备异步数据                         | `module.prepare(ctx, instance, scope)` | 加载模型、模板、资源 preset |
| `rendered`        | 提供 iframe root 并挂载 UI                 | `module.render(ctx, instance, root, scope)` | 创建 DOM，返回 view controller |
| `updated`         | 插件 state 变化后刷新视图                  | `view.update(change)`      | 根据状态差异局部更新 DOM         |
| `host-changed`    | 宿主状态属性变化                           | `view.onHostStateChange(event)` | 响应语言、主题、只读、选区等变化 |
| `active`          | 面板可见、可交互                           | `view.activate(scope)`     | 恢复焦点、启动可见态逻辑         |
| `inactive`        | 面板隐藏或暂时失焦                         | `view.deactivate(scope)`   | 暂停仅可见时需要的工作           |
| `disposing`       | 插件关闭、重载、报错或宿主卸载             | `view.dispose(reason)` + `module.dispose(reason)` | 释放视图资源和实例资源 |
| `disposed`        | 清理完成，实例不可再使用                   | 无                         | 无                               |

## 6. 完整插件示例

下面的例子展示每个生命周期如何使用。重点是：DOM 引用都在 `render` 的闭包里，`update` 不需要 `document.querySelector`，也不需要把 DOM 节点塞进 `instance.view`。

```js
registerMagicCanvasPlugin({
	create(ctx) {
		return {
			state: ctx.state.create({
				garments: [],
				modelImage: null,
				models: [],
				loading: false,
			}),
			abortController: null,
		}
	},

	async prepare(ctx, instance, scope) {
		const models = await ctx.ai.getImageModels({ signal: scope.signal })
		if (scope.signal.aborted) return
		ctx.state.patch(instance.state, { models }, { silent: true })
	},

	render(ctx, instance, root, scope) {
		const panel = document.createElement("div")
		panel.className = "virtual-tryon-panel"

		const garmentGrid = document.createElement("div")
		garmentGrid.className = "virtual-tryon-garment-grid"

		const generateButton = document.createElement("button")
		const renderTexts = () => {
			generateButton.textContent = ctx.i18n.t("button.generate")
		}
		const renderDisabledState = () => {
			generateButton.disabled = ctx.host.accessMode !== "edit" || instance.state.loading
		}
		const renderGarmentGrid = () => {
			garmentGrid.replaceChildren(
				...instance.state.garments.map((garment) => {
					const item = document.createElement("img")
					item.src = garment.url
					item.alt = garment.name
					return item
				}),
			)
		}

		const handleGenerate = async () => {
			ctx.state.patch(instance.state, { loading: true })
			try {
				instance.abortController = new AbortController()
				await ctx.ai.generateAndPlace(buildGenerateRequest(instance.state), {
					signal: instance.abortController.signal,
				})
				ctx.ui.toast(ctx.i18n.t("toast.success"), "success")
				ctx.ui.close()
			} finally {
				instance.abortController = null
				ctx.state.patch(instance.state, { loading: false })
			}
		}

		generateButton.addEventListener("click", handleGenerate)
		panel.append(garmentGrid, generateButton)
		root.append(panel)

		renderTexts()
		renderDisabledState()
		renderGarmentGrid()

		return {
			update(change) {
				if (change.keys.has("loading")) {
					renderDisabledState()
				}
				if (change.keys.has("garments")) {
					renderGarmentGrid()
				}
			},

			onHostStateChange(event) {
				if (event.type === "locale-change") {
					renderTexts()
				}
				if (event.type === "access-mode-change") {
					renderDisabledState()
				}
			},

			activate() {
				generateButton.focus()
			},

			deactivate() {
				instance.abortController?.abort()
				instance.abortController = null
			},

			dispose() {
				generateButton.removeEventListener("click", handleGenerate)
				root.replaceChildren()
			},
		}
	},

	dispose(ctx, instance, reason) {
		instance.abortController?.abort()
		instance.abortController = null
		ctx.state.replace(instance.state, {
			garments: [],
			modelImage: null,
			models: [],
			loading: false,
		}, { silent: true })
	},
})
```

`registerMagicCanvasPlugin` 注册的是运行时行为对象。插件身份和展示配置来自 `manifest.json`，不从注册对象读取。

## 7. Runtime 调用示例

下面的伪代码展示 runtime 如何调用每个生命周期。真实实现可以拆到 `PluginManager`、`PluginRuntimeFrame`、RPC bridge 等模块里，但调用顺序应保持一致。

```ts
async function openPlugin(manifest: PluginManifest) {
	const runtime = await createPluginRuntime(manifest)
	const ctx = createPluginContext(manifest)
	const scope = createLifecycleScope({ reason: "open" })
	let module: PluginModule | undefined
	let instance: PluginInstance | undefined
	let view: PluginViewController | undefined

	try {
		// entry-loaded: 插件脚本执行后必须调用 registerMagicCanvasPlugin
		module = await runtime.loadEntry(manifest.entry)

		// created
		instance = module.create(ctx)

		// prepared
		await module.prepare?.(ctx, instance, scope)
		scope.throwIfAborted?.()

		// rendered
		view = normalizeView(await module.render(ctx, instance, runtime.root, scope))

		// state updates
		ctx.state.bind(instance.state, (change) => {
			view?.update?.(change)
		})

		// active
		await view?.activate?.(scope)

		return {
			async onHostStateChange(event) {
				await view?.onHostStateChange?.(event)
			},

			async setActive(active: boolean) {
				if (active) {
					await view?.activate?.(scope)
				} else {
					await view?.deactivate?.(scope)
				}
			},

			async close(reason: PluginDisposeReason = "close") {
				scope.abort(reason)
				ctx.state.unbind(instance.state)
				await view?.deactivate?.(scope)
				await view?.dispose?.(reason)
				await module?.dispose?.(ctx, instance, reason)
				runtime.destroy()
			},
		}
	} catch (error) {
		scope.abort("runtime-error")
		if (instance) {
			ctx.state.unbind(instance.state)
			await view?.dispose?.("runtime-error")
			await module?.dispose?.(ctx, instance, "runtime-error")
		}
		runtime.destroy()
		throw error
	}
}
```

调用规则：

1. `create` 只调用一次，失败后不进入后续阶段。
2. `prepare` 只在首次挂载前调用；重试和 reload 都创建新实例重新调用。
3. `render` 成功后才允许调用 `view.activate`、`view.update` 和 `view.onHostStateChange`。
4. `ctx.state.patch/replace` 是触发 `view.update` 的标准入口，runtime 可以在 `ctx.state.bind` 内做批量调度。
5. `view.update` 只派发给已经 render 的实例；多次状态变更可以合并成一次 update。
6. `view.onHostStateChange` 只派发给已经 render 的实例。
7. `view.deactivate` 可以调用多次，插件实现应保持幂等。
8. 关闭顺序是 `view.deactivate -> view.dispose -> module.dispose -> destroy iframe`。
9. `module.dispose` 是最后的实例 hook；调用后 runtime 不再向该实例派发事件。

## 8. 生命周期职责

### 8.1 `create(ctx)`

创建插件实例。这里可以创建业务状态、任务句柄和缓存容器，但不操作 DOM。

```js
create(ctx) {
	return {
		state: ctx.state.create({
			loading: false,
			garments: [],
		}),
		abortController: null,
	}
}
```

约束：

1. `create` 应尽量同步完成。
2. 不在 `create` 里请求模型、读取远程资源或操作 DOM。
3. 不把 `ctx` 暴露到全局变量，避免重载后已失效实例继续持有宿主能力。
4. 如果 `create` 抛错，runtime 标记插件实例创建失败，不进入 `prepare/render`。

### 8.2 `prepare(ctx, instance, scope)`

可选。用于挂载 UI 前准备数据，例如模型列表、模板配置、插件资源。

```js
async prepare(ctx, instance, scope) {
	const models = await ctx.ai.getImageModels({ signal: scope.signal })
	ctx.state.patch(instance.state, { models }, { silent: true })
}
```

`prepare` 失败时，runtime 应显示插件加载失败，并允许重试。

约束：

1. 只做数据准备，不创建 DOM。
2. 所有异步任务都应支持取消；如果 runtime 提供 `scope.signal`，插件应传给 fetch、轮询或自定义任务。
3. `prepare` 可以失败，失败后不调用 `render`。
4. 用户重试时，runtime 应创建新实例，而不是复用失败实例。
5. `prepare` 阶段可以通过 `{ silent: true }` 写入初始 state，因为此时 view 还没有绑定。

### 8.3 `render(ctx, instance, root, scope)`

挂载 UI 并返回 view controller。`root` 是 iframe 内 DOM，不是宿主页面 DOM。

```js
render(ctx, instance, root, scope) {
	const button = document.createElement("button")
	root.append(button)

	return {
		update(change) {},
		activate() {},
		deactivate() {},
		dispose() {
			root.replaceChildren()
		},
	}
}
```

约束：

1. `render` 只负责 iframe 内 UI，不访问宿主 DOM。
2. `render` 应创建稳定 DOM。状态变化时由 `view.update` 局部更新节点，避免反复重建 `root`。
3. DOM 引用、事件监听、ResizeObserver、Object URL 等与 UI 绑定的资源，都优先放在 `render` 闭包和 `view.dispose` 中管理。
4. 如果 `render` 抛错，runtime 应立即进入 `module.dispose("runtime-error")`；如果已经创建了局部资源，插件应通过 try/finally 或内部 helper 清理。

### 8.4 `view.update(change)`

可选。用于响应插件自身 state 变化，并局部更新 DOM。

```js
update(change) {
	if (change.keys.has("loading")) {
		button.disabled = instance.state.loading
	}
}
```

`change` 建议至少包含：

```ts
interface PluginStateChange {
	prevState: unknown
	nextState: unknown
	keys: Set<string>
	reason?: string
}
```

状态更新应由 runtime 提供统一入口：

```js
ctx.state.patch(instance.state, {
	loading: true,
})
```

调用约定：

1. `render` 负责首次挂载 DOM。
2. `view.update` 负责后续 state 变化后的 DOM 同步。
3. 插件业务逻辑不建议到处直接改 DOM；应先更新 state，再由 `view.update` 统一刷新视图。
4. runtime 可以把同一 tick 内多次 `ctx.state.patch` 合并为一次 `view.update`，减少 DOM 抖动。
5. `view.update` 不应该创建新的根 DOM，也不应该重新绑定所有事件。

这个 hook 只处理插件自身 state，不处理宿主状态。宿主状态变化走 `view.onHostStateChange`。

### 8.5 `view.onHostStateChange(event)`

可选。接收宿主状态属性变化。

```js
onHostStateChange(event) {
	if (event.type === "access-mode-change") {
		button.disabled = event.accessMode !== "edit" || instance.state.loading
	}
}
```

这里的变化只指宿主状态属性变化，不指宿主能力方法变化。插件可调用的方法由 `manifest.capabilities` 和 runtime 注入的 `ctx` 决定，原则上在一个插件实例生命周期内保持稳定。

第一阶段可以先定义事件类型，不一定全部实现：

| 事件                      | 说明                 |
| ------------------------- | -------------------- |
| `locale-change`           | 宿主语言变化          |
| `theme-change`            | 主题变化              |
| `access-mode-change`     | 访问模式变化          |
| `selection-change`        | 选区变化              |
| `resource-change`         | 项目资源变化          |
| `panel-visibility-change` | 面板显示或隐藏        |

### 8.6 `view.activate(scope)` / `view.deactivate(scope)`

可选。用于区分“实例存在”与“插件当前可见/可交互”。

```js
activate() {
	button.focus()
}

deactivate() {
	instance.abortController?.abort()
}
```

使用场景：

1. 用户打开插件面板时调用 `view.activate`。
2. 面板被隐藏、切换到其他插件、进入只读预览或宿主临时挂起时调用 `view.deactivate`。
3. `deactivate` 不等于销毁。插件实例可以保留表单状态，等待再次 `activate`。
4. 只有 `dispose` 才表示实例彻底不可再使用。

第一阶段如果插件面板关闭即销毁，可以先不实现 inactive 缓存；但生命周期命名上应预留 `activate/deactivate`，避免后续把“隐藏”和“销毁”混在一起。

### 8.7 `view.dispose(reason)`

释放视图资源：

1. 解绑 DOM 事件。
2. 停止 ResizeObserver、MutationObserver。
3. 释放 view 内创建的 Object URL。
4. 清空 iframe root。
5. 销毁第三方 UI 库实例。

```js
dispose() {
	button.removeEventListener("click", handleClick)
	root.replaceChildren()
}
```

`view.dispose` 应设计为幂等。即使被重复调用，也不应该抛错或重复触发业务请求。

### 8.8 `module.dispose(ctx, instance, reason)`

释放插件实例资源：

1. 取消上传、生成、轮询等异步任务。
2. 清理定时器。
3. 释放实例级缓存。
4. 清理 iframe 内全局监听。
5. 丢弃无法继续使用的业务状态。

```js
dispose(ctx, instance, reason) {
	instance.abortController?.abort()
	instance.abortController = null
}
```

清理顺序建议：

1. runtime 停止继续向插件派发新事件。
2. abort 当前 lifecycle scope。
3. 解绑 state update。
4. 调用 `view.deactivate(scope)`。
5. 调用 `view.dispose(reason)`。
6. 调用 `module.dispose(ctx, instance, reason)`。
7. 移除 iframe。
8. 清理 pending RPC。

## 9. DOM 实例共享

DOM 引用应该保存在 `render` 的闭包里，由 view controller 的方法共享，而不是保存在 `instance.view`，也不是每次 `update` 都重新 `document.querySelector`。

推荐写法：

```js
render(ctx, instance, root) {
	const button = document.createElement("button")
	const grid = document.createElement("div")

	const renderLoading = () => {
		button.disabled = instance.state.loading
	}

	root.append(grid, button)

	return {
		update(change) {
			if (change.keys.has("loading")) {
				renderLoading()
			}
		},
		dispose() {
			root.replaceChildren()
		},
	}
}
```

不推荐写法：

```js
function syncLoadingByQuerySelector(instance) {
	const button = document.querySelector(".generate-button")
	button.disabled = instance.state.loading
}
```

也不推荐把 DOM refs 放进实例：

```js
create() {
	return {
		state: {},
		view: {
			button: null,
		},
	}
}
```

原因：

1. `instance` 应该描述业务实例，不应该混入 DOM 生命周期。
2. DOM refs 的有效期和 `render` 绑定，天然适合放在 `render` 闭包。
3. `view.dispose` 可以和这些 refs 在同一个闭包内完成解绑，减少泄漏。
4. 多个 view 形态、Panel Kit、自定义 DOM 可以共用同一套实例模型。

复杂列表可以在 `render` 闭包中维护局部 Map：

```js
render(ctx, instance, root) {
	const itemNodes = new Map()

	const patchItems = () => {
		for (const item of instance.state.items) {
			let node = itemNodes.get(item.id)
			if (!node) {
				node = document.createElement("button")
				itemNodes.set(item.id, node)
				root.append(node)
			}
			node.textContent = item.name
		}
	}

	return {
		update(change) {
			if (change.keys.has("items")) {
				patchItems()
			}
		},
		dispose() {
			itemNodes.clear()
			root.replaceChildren()
		},
	}
}
```

## 10. `ctx` 设计

`ctx` 是插件唯一的宿主能力入口。

建议把 `ctx` 明确拆成两类：

1. 状态属性：描述当前宿主状态，可能随时间变化。
2. 能力方法：插件可以调用的宿主能力，应在插件实例生命周期内保持稳定。

### 10.1 状态属性

状态属性可以直接读取，也可以通过 `view.onHostStateChange` 接收变化：

```text
ctx.plugin        当前插件静态信息，来自 manifest
ctx.host.locale   当前语言
ctx.host.theme    当前主题
ctx.host.accessMode 当前访问模式（edit / readonly / share / history）
ctx.host.panel    当前面板状态，例如 visible、width、height
```

状态属性变化时，runtime 发事件：

```js
onHostStateChange({
	type: "access-mode-change",
	accessMode: "readonly",
})
```

状态属性适合表达“现在是什么状态”，不适合表达“能做什么操作”。

### 10.2 能力方法

能力方法来自 `manifest.capabilities` 声明和 runtime 注入：

```text
ctx.i18n.t            多语言取文案
ctx.ui.toast          提示
ctx.ui.close          关闭面板
ctx.ui.setHeight      设置面板高度
ctx.state.create      创建插件 state 容器
ctx.state.patch       合并局部 state 并触发 view.update
ctx.state.replace     替换整体 state 并触发 view.update
ctx.panel.render      Panel Kit
ctx.resources.resolve 插件包内资源解析
ctx.assets.pickFiles  选择文件（含资源面板选图）
ctx.assets.uploadFile 上传本地文件
ctx.assets.resolveFileAssets 按项目 path 解析已有资源，不上传
ctx.assets.readCanvasClipboard 由 Host 读取画布 V2 剪贴板 metadata
ctx.assets.fetchBlob  按 URL 拉取 Blob
ctx.ai.getImageModels 获取模型
ctx.ai.completeImagePrompt AI 补全图片提示词
ctx.ai.generateAndPlace 生成并放入画布
ctx.task.*            长任务、取消、进度
ctx.storage.*         插件会话态或本地偏好
```

第一阶段可以只实现当前已有能力：

```text
ctx.plugin
ctx.i18n
ctx.ui
ctx.state
ctx.resources
ctx.assets
ctx.ai
```

能力方法不建议通过 `onHostStateChange` 做增删。如果只读态、权限或业务状态导致某个能力暂不可用，推荐：

1. 状态属性表达当前访问模式，例如 `ctx.host.accessMode = "readonly"`。
2. UI 根据状态禁用入口。
3. 方法被调用时返回结构化错误，例如 `READONLY`、`CAPABILITY_UNAVAILABLE`。

这样插件作者可以把“状态响应”和“能力调用”分开处理，runtime 也不需要在运行中替换 `ctx.ai.generateAndPlace`、`ctx.ai.completeImagePrompt` 这类方法引用。

### 10.2.1 `ctx.ai.completeImagePrompt`

用于调用宿主侧的通用 AI 提示词补全接口，返回一段可直接写回输入框的 prompt 文本。该方法只补全文字，不直接触发生图。

前置要求：

1. `manifest.capabilities` 必须声明 `ai.completeImagePrompt`
2. 调用方自行组装 `user_prompt`
3. 如果插件场景需要参考图，传 `reference_images`

参数结构：

```ts
ctx.ai.completeImagePrompt({
	user_prompt: string,
	model_id?: string,
	reference_images?: string[],
	reference_image_options?: Array<{
		path: string
		crop?: { x: number; y: number; width: number; height: number }
	}>
})
```

返回结构：

```ts
Promise<{
	prompt: string
}>
```

示例：

```js
const result = await ctx.ai.completeImagePrompt({
	user_prompt:
		"请根据上传的商品图生成一段适合每张图片分别套用的中文背景提示词，不要描述多商品同框关系。",
	reference_images: helpers.collectReferenceIds(state.productImages),
})

ctx.state.patch(state, {
	backgroundPrompt: result.prompt,
})
```

约定：

1. 插件可以不传 `model_id`，由后端默认模型处理。
2. `reference_images` 走宿主资源路径，不直接传 base64。
3. 返回值为空或异常时，应由插件自行决定错误提示与回填策略。

### 10.2.2 画布剪贴板粘贴（`readCanvasClipboard` / `resolveFileAssets`）

插件 iframe 无法直接读取画布 V2 私有剪贴板 bundle。当用户从画布复制元素后粘贴到插件面板时，需经 Host 桥接：

```text
插件 ctx.assets.readCanvasClipboard()
  -> postMessage magic-canvas-plugin:read-canvas-clipboard
  -> Host readPluginCanvasClipboard（CanvasElementClipboard.read）
  -> 回传 { payload, uploadedAssets }
```

`payload` 结构（不含 elements / Blob）：

```ts
{
  source: "canvas-design",
  version: 1,
  operation: "copy-elements" | "copy-as-png",
  files: Array<{
    id: string
    elementId: string
    filename: string
    mimeType: string
    fileSize: number
    role: "element-media" | "canvas-export"
    sourceRef?: { src?: string; ossUrl?: string; expiresAt?: string }
  }>
}
```

导入策略：

| operation | 处理方式 |
| --------- | -------- |
| `copy-as-png` | Host 对 bundle 内 Blob upload，回传 `uploadedAssets`；或插件对 paste event 中的 `image/png` 走 `uploadFile` |
| `copy-elements` | 对带 `sourceRef.src` 的 `element-media` 调用 `ctx.assets.resolveFileAssets([{ path, fileName }])`，按 path 解析、**不上传** |

`resolveFileAssets` 参数示例：

```js
const assets = await ctx.assets.resolveFileAssets(
	[{ path: "uploads/foo.png", fileName: "foo.png" }],
	{ type: "image" },
)
```

返回 `PluginFileAsset[]`，同时含 `path`（稳定标识）与 `url` / `src`（当前可访问 URL）。

Capability 映射：

- `ctx.assets.readCanvasClipboard` → 声明 `assets.pickFiles`（与 pick / resolve 共用 bridge 权限）
- `ctx.assets.resolveFileAssets` → 声明 `assets.pickFiles`

内置插件通过 `magic-plugin-kit` 的 `image-grid` / `image-slot` 已封装上述逻辑，业务插件一般无需直接调用。自定义粘贴 UI 时可参考 kit 内 `resolvePastedImageAssets`。

### 10.2.3 画布图片拖拽到插件（Alt/Option + 左键）

除复制粘贴外，用户可将画布图片 **按住 Alt/Option + 左键拖拽** 到插件 `image-grid` / `image-slot` 上传区。

```text
画布 SelectionTool
  -> image:external-drag:start|move|end
  -> Host useCanvasImageExternalDragToPlugin
       · ghost 预览（useImageLowUrl，避免过期 ossSrc 403）
       · iframe 坐标转换
       · mouseup 时 exportElementsAsPNGBlob / resolve
  -> postMessage magic-canvas-plugin:canvas-asset-drag-move|leave|drop
  -> iframe window.dispatchEvent(CustomEvent)
  -> kit elementFromPoint + ctx.assets.reportCanvasAssetDragTarget
  -> kit handleCanvasAssetDrop → importCanvasAssetFiles
```

协议消息（v1 runtime）：

| 方向 | type | 说明 |
| ---- | ---- | ---- |
| Host → iframe | `magic-canvas-plugin:canvas-asset-drag-move` | `{ clientX, clientY, assetsMeta: { count, originElementId } }` |
| Host → iframe | `magic-canvas-plugin:canvas-asset-drag-leave` | 指针离开或拖拽结束，清理 hover |
| Host → iframe | `magic-canvas-plugin:canvas-asset-drop` | `{ targetId, files: PluginFileAsset[] }` |
| iframe → Host | `magic-canvas-plugin:canvas-asset-drag-target` | `{ targetId, mode: "grid"\|"slot", canDrop }` |

导入策略：

| 目标 mode | 行为 |
| --------- | ---- |
| `grid` | 批量 append，按 `referenceId` 去重，受 `maxCount` 截断 |
| `slot` | 只取拖拽起点单图，替换当前槽位 |

Capability：`ctx.assets.reportCanvasAssetDragTarget` 由 runtime v1 `createPluginSrcDoc` 注入，与 `assets.pickFiles` 共用 bridge 权限（插件需声明 `assets.pickFiles` 才能使用上传区与画布导入）。

空态导入说明：kit 在空态上传框 hover 时展示 tooltip（key `imageImport.canvasHint`），详见 `magic-plugin-kit/README.md`「图片导入」。

### 10.3 分层总览

```text
ctx.plugin     静态插件信息
ctx.host       可变宿主状态属性
ctx.i18n       能力方法：多语言
ctx.ui         能力方法：宿主 UI
ctx.state      能力方法：状态更新
ctx.panel      能力方法：Panel Kit
ctx.resources  能力方法：插件资源
ctx.assets     能力方法：素材选择和上传
ctx.ai         能力方法：模型和生成
ctx.task       能力方法：长任务
ctx.storage    能力方法：存储
```

`ctx.task` 和 `ctx.storage` 可以作为下一阶段能力，不阻塞范式落地。

## 11. 状态管理

插件状态分三类：

| 状态类型 | 示例                         | 建议存放位置              |
| -------- | ---------------------------- | ------------------------- |
| UI 会话态 | 当前选择的图片、表单输入、loading | `instance.state`           |
| 用户偏好 | 上次选择的模型、默认尺寸         | 后续 `ctx.storage`         |
| 画布数据 | 生成结果、元素、资源路径         | CanvasDesign 现有数据模型 |

第一阶段不要急着做持久化状态。先确保插件关闭时能完整释放实例，再根据真实场景引入 `ctx.storage`。

插件自身 state 应通过统一入口更新：

```js
ctx.state.patch(instance.state, {
	loading: true,
})
```

推荐提供三个基础方法：

| 方法                  | 说明                           |
| --------------------- | ------------------------------ |
| `ctx.state.create`    | 创建可被 runtime 追踪的 state 容器 |
| `ctx.state.patch`     | 合并局部 state，并触发 view.update |
| `ctx.state.replace`   | 替换整个 state，并触发 view.update |

不建议插件直接写完 `instance.state.xxx = value` 后再手动改 DOM。直接赋值适合非常早期的初始化或 dispose 清理；运行期交互状态应走 `ctx.state.patch/replace`，让 runtime 能统一批量派发 `view.update`。

`ctx.state.patch/replace` 可以支持 `{ silent: true }`：

```js
ctx.state.patch(instance.state, { models }, { silent: true })
```

`silent` 只适合 `prepare` 或 `dispose` 这类 view 不存在或不需要刷新的阶段。用户交互阶段默认不应使用 `silent`。

## 12. UI 开发方式

UI 开发建议提供两条路径：

1. Panel Kit：适合大多数表单类 AI 插件。
2. DOM Escape Hatch：适合完全自定义 UI。

### 12.1 Panel Kit

Panel Kit 是运行时提供的 UI helper，不是插件协议本身。

```js
render(ctx, instance, root) {
	return ctx.panel.render(root, {
		state: instance.state,
		sections: [
			{
				id: "garments",
				kind: "image-grid",
				stateKey: "garments",
				title: ctx.i18n.t("section.garments"),
				maxCount: 5,
			},
			{
				id: "extra",
				kind: "textarea",
				stateKey: "extraPrompt",
				title: ctx.i18n.t("section.extra"),
			},
		],
		generate: {
			buttonLabel: ctx.i18n.t("button.generate"),
			loadingLabel: ctx.i18n.t("button.generating"),
			validate: ({ state }) => {
				if (!state.garments.length) return ctx.i18n.t("empty.garments")
				return null
			},
			execute: async ({ state, generateAndPlace }) => {
				return generateAndPlace(buildGenerateRequest(state))
			},
		},
	})
}
```

`ctx.panel.render` 应返回 view controller。Panel Kit 可以内部接管 `update/onHostStateChange/activate/deactivate/dispose`，插件作者只需要提供配置和业务回调。

Panel Kit 的定位是“panel 渲染工具”，插件协议层只关心它返回的 view controller。

### 12.2 DOM Escape Hatch

插件仍然可以直接写 DOM：

```js
render(ctx, instance, root) {
	const button = document.createElement("button")
	button.textContent = ctx.i18n.t("button.generate")
	root.append(button)

	return {
		update(change) {
			if (change.keys.has("loading")) {
				button.disabled = instance.state.loading
			}
		},
		dispose() {
			root.replaceChildren()
		},
	}
}
```

约束不变：

1. 不访问宿主 DOM。
2. 不访问父窗口对象。
3. 不直接调用 Canvas 实例。
4. 所有宿主能力通过 `ctx`。

## 13. 失败、重试和 reload

### 13.1 失败与重试

失败分三类处理：

| 失败点         | 处理方式                                      |
| -------------- | --------------------------------------------- |
| manifest       | 插件不进入可运行列表，展示配置错误或跳过       |
| entry/create   | 插件进入加载失败态，允许重新加载 entry         |
| prepare/render | 当前实例失败，执行 cleanup/dispose 后允许重试  |

重试策略：

1. 不复用失败实例。
2. 重新读取当前插件包资源。
3. 重新创建 iframe 和插件实例。
4. 已关闭实例的 pending RPC 结果应丢弃。

### 13.2 开发期 reload

开发阶段不基于 `version` 判断普通代码更新。`version` 只选择 runtime 处理器，reload 是显式动作：

```text
reloadPlugin(name)
  ↓
view.deactivate current view
  ↓
view.dispose current view
  ↓
module.dispose current instance with reason = "reload"
  ↓
reload manifest / entry / styles
  ↓
create new instance
  ↓
prepare
  ↓
render
  ↓
view.activate
```

reload 的目标是让插件作者快速验证当前插件包，不做复杂差异合并，不保留已关闭 iframe，也不在不同实例之间共享运行时状态。

只有当 CanvasDesign 插件协议出现不兼容变化时，才新增 runtime 处理器版本，例如新建 `PluginPanel/runtime/v2`，并让需要新协议的插件把 `manifest.version` 改为 `2`。已有的 `runtime/v1` 必须保留，继续服务 `version: 1` 的插件。

## 14. 最小实现范围

第一阶段建议只做这些：

1. manifest 支持 `name/version/capabilities`，不暴露 UI 入口配置字段。
2. runtime 支持 `create -> prepare -> render -> view.update -> view.dispose -> module.dispose`。
3. runtime 预留 `view.onHostStateChange/view.activate/view.deactivate`。
4. lifecycle scope 预留 `AbortSignal`，用于取消 prepare、上传、生成和资源加载。
5. `ctx.state.create/patch/replace` 负责插件 state 更新和 `view.update` 派发。
6. 插件窗口默认尺寸、最小高度和最大高度由 CanvasDesign 宿主侧固定。
7. `capabilities` 做 runtime bridge 强制白名单。
8. 当前 runtime 处理器落在 `PluginPanel/runtime/v1`，后续不兼容协议通过 `v2/v3` 目录扩展。
9. `MagicPluginKit` 下沉为 `ctx.panel.render`。
10. 不实现插件市场、远程权限弹窗或复杂升级分发。

## 15. 设计原则

1. 静态信息必须在 manifest 中，避免执行 JS 才知道插件是什么。
2. 插件运行时只描述行为，不重复静态配置。
3. `plugin module` 管实例生命周期，`view controller` 管 DOM 生命周期。
4. 插件 instance 不保存 DOM 引用，DOM 引用由 `render` 闭包持有。
5. state 更新触发 `view.update`，不重新创建视图。
6. 宿主状态属性和宿主能力方法要分开设计。
7. Panel Kit 是 UI helper，不是插件协议。
8. `version` 只表达 runtime 处理器版本，不表达插件业务发布版本。
9. 能力通过 `ctx` 白名单注入，不暴露 Canvas 实例。
10. 先服务真实内置插件开发场景，再考虑市场和第三方开放。

## 16. 相关文档

1. 当前项目内置插件维护和迭代流程见 `plugin-maintenance-and-iteration.md`。
2. 面向插件开发者的 runtime version 升级流程见 `plugin-upgrade-guide.md`。
