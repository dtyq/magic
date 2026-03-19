import { MagicRichEditorRef } from "@/components/base/MagicRichEditor"
import { debounce } from "lodash-es"
import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import type { Transaction, EditorState } from "@tiptap/pm/state"
import AiCompletionTip from "@/stores/chatNew/editor/AiCompletionTip"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"
import AiCompletionStore from "@/stores/chatNew/editor/AiCompletion"
import { logger as Logger } from "@/utils/log"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"

const logger = Logger.createLogger("AiCompletionService")

/**
 * AI 自动补全请求上下文
 */
export interface AIAutoCompletionContext {
	prefix: string
	suffix: string
	cursor: number
	selectionFrom: number
	selectionTo: number
	docSize: number
	currentLinePrefix: string
	currentLineSuffix: string
}

/**
 * AI自动补全扩展选项接口
 */
export interface AIAutoCompletionExtensionOptions {
	/**
	 * 获取建议词的函数，接收当前文本和可选的AbortSignal，返回建议
	 */
	fetchSuggestion?: (value: string, signal?: AbortSignal) => Promise<string>
	/**
	 * 是否总是显示提示
	 */
	alwaysShowTip?: boolean
	/**
	 * 基于光标上下文的建议函数（优先于 fetchSuggestion）
	 */
	fetchSuggestionWithContext?: (
		context: AIAutoCompletionContext,
		signal?: AbortSignal,
	) => Promise<string>
}

/**
 * AI自动补全服务
 * 负责管理编辑器中的AI补全功能，包括显示、隐藏建议词和处理用户交互
 *
 * 主要工作流程：
 * 1. 用户输入 -> onUpdate 触发 -> triggerFetchSuggestion 获取建议
 * 2. 获取建议成功 -> updateSuggestion 更新UI -> 用户可按Tab接受建议
 * 3. 用户按Tab -> 调用 editor.commands.insertContent 插入建议 -> clearSuggestion 清除建议词理
 */
class AiCompletionService {
	/** 编辑器实例引用 */
	instance: MagicRichEditorRef | null = null

	/** 是否正在进行输入法组合输入（如中文输入） */
	composition: boolean = false

	/** 当前文本内容的缓存，用于比较变化 */
	valueCache: string = ""

	/** 当前的建议词 */
	currentSuggestion: string = ""

	/** 标记是否在执行撤销/重做等历史操作 */
	isHistoryOperation: boolean = false

	/** AI自动补全配置选项 */
	aiAutoCompletionOptions: AIAutoCompletionExtensionOptions | undefined

	/** 标记是否正在执行清理操作，避免清理过程中触发其他操作 */
	isClear: boolean = false

	/** 当前正在进行的请求控制器，用于取消未完成的请求 */
	currentRequest: AbortController | null = null

	/** 上次请求的文本内容，用于避免重复请求 */
	lastRequestText: string = ""

	/** 上次请求上下文指纹，用于避免重复请求 */
	lastRequestFingerprint: string = ""

	/** 标记是否是插入提示词导致的变更 */
	isInsertSuggestionChange: boolean = false

	/** 插件是否启用，默认为 true */
	enabled: boolean = true

	/**
	 * 构造函数
	 * @param aiAutoCompletionOptions AI自动补全配置选项
	 */
	constructor(aiAutoCompletionOptions?: AIAutoCompletionExtensionOptions) {
		this.instance = null
		this.aiAutoCompletionOptions = aiAutoCompletionOptions

		logger.report("service_init", {
			alwaysShowTip: aiAutoCompletionOptions?.alwaysShowTip,
			hasFetchSuggestion: !!aiAutoCompletionOptions?.fetchSuggestion,
		})
	}

	/**
	 * 计算上下文指纹，避免重复请求
	 */
	private buildContextFingerprint = (ctx: AIAutoCompletionContext) => {
		const prefixTail = ctx.prefix.slice(-32)
		const suffixHead = ctx.suffix.slice(0, 32)
		return `${ctx.cursor}:${ctx.docSize}:${prefixTail}|${suffixHead}`
	}

	/**
	 * 获取本地存储的键名
	 */
	get localStorageKey() {
		const userId = userStore.user.userInfo?.user_id
		return platformKey(`ai-completion-tab-count/${userId}`)
	}

	/**
	 * 获取Tab键点击次数
	 */
	getTabCount() {
		const tabCount = localStorage.getItem(this.localStorageKey)
		const count = tabCount ? parseInt(tabCount) : 0

		// Remove logging from getTabCount - too frequent and not actionable

		return count
	}

	/**
	 * 增加Tab键点击次数
	 */
	addTabCount() {
		const tabCount = this.getTabCount()
		const newCount = tabCount + 1
		localStorage.setItem(this.localStorageKey, newCount.toString())
	}

	/**
	 * 设置编辑器实例
	 * 在组件挂载时调用此方法
	 * @param instance 富文本编辑器实例
	 */
	setInstance = (instance: MagicRichEditorRef) => {
		// Remove editor instance logging - technical detail, not user behavior
		this.instance = instance
	}

	/**
	 * 判断文本是否为空
	 * 被 updateSuggestion 调用，用于决定是否显示提示
	 * @param suggestion 要检查的文本
	 * @returns 是否为空（null、undefined、空字符串、只包含空白或特殊字符）
	 */
	isEmptyText = (suggestion?: string) => {
		// 处理null、undefined、空字符串情况
		if (!suggestion) return true

		// 处理只包含空白字符的情况
		const trimmed = suggestion.trim()
		if (trimmed.length === 0) return true

		// 检查是否只包含不可见字符或特殊字符
		// 通过将所有不可打印字符一个个替换掉，看是否有可见内容
		let visible = trimmed

		// 删除空格和制表符
		visible = visible.replace(/\s+/g, "")

		// 删除常见的零宽字符（一个个单独替换）
		visible = visible.replace(/\u200B/g, "") // 零宽空格
		visible = visible.replace(/\u200C/g, "") // 零宽非连接符
		visible = visible.replace(/\u200D/g, "") // 零宽连接符
		visible = visible.replace(/\uFEFF/g, "") // 零宽不换行空格
		visible = visible.replace(/\u200E/g, "") // 零宽非断字空格

		visible = visible.replace(/\uFE0F/g, "")

		// 最终检查是否为空
		return visible.length === 0
	}

	/**
	 * 更新建议词并显示提示
	 * 由 triggerFetchSuggestion 在获取新建议后调用
	 * 也被 clearSuggestion 调用来清除建议
	 * @param suggestion 建议词
	 */
	updateSuggestion = (suggestion?: string) => {
		const editor = this.instance?.editor
		if (!editor) return

		const isEmpty = this.isEmptyText(suggestion)
		// 如果建议为空，隐藏提示并清除属性
		if (isEmpty) {
			logger.report("suggestion_lifecycle", {
				action: "empty",
				reason: !suggestion ? "null/undefined" : "invisible_chars",
			})

			// 使用 chain API 确保在一个事务中完成，并设置不加入历史记录
			// 这样用户撤销/重做时不会意外地恢复空的建议词状态
			editor
				.chain()
				.command(({ tr }) => {
					tr.setMeta("addToHistory", false)
					tr.setMeta("suggestionUpdate", true)
					return true
				})
				.updateAttributes("paragraph", { suggestion: "" })
				.run()

			AiCompletionStore.clearSuggestion()
			AiCompletionTip.hide()
			return
		}

		// 保存当前建议词以便恢复
		this.currentSuggestion = suggestion || ""

		// 使用 chain API 在一个事务中完成所有操作，确保不影响历史记录
		editor
			.chain()
			.command(({ tr }) => {
				tr.setMeta("addToHistory", false)
				tr.setMeta("suggestionUpdate", true)
				return true
			})
			.updateAttributes("paragraph", { suggestion: suggestion || "" })
			.run()

		logger.report("suggestion_lifecycle", {
			action: "show",
			length: suggestion?.length || 0,
		})

		// 获取文档末尾位置，用于显示提示
		const caretRect = this.getCurrentCursorPosition() || this.getDocumentEndPosition()

		// Check if editor is focused
		const isEditorFocused = this.instance?.editor?.isFocused ?? false

		// 如果有位置信息且建议不为空且编辑器已聚焦，则显示提示
		if (caretRect && !isEmpty && isEditorFocused) {
			if (this.aiAutoCompletionOptions?.alwaysShowTip || this.getTabCount() < 2) {
				AiCompletionStore.setSuggestion(suggestion || "")
				AiCompletionTip.show({
					left: caretRect.left,
					top: caretRect.top + caretRect.height,
				})
			}
		} else if (isEmpty || !isEditorFocused) {
			AiCompletionStore.clearSuggestion()
			AiCompletionTip.hide()
		}
	}

	/**
	 * 获取文档末尾的视图坐标位置
	 * 使用 TipTap 的 view.coordsAtPos API，无需临时聚焦即可获取位置
	 * @returns 文档末尾位置的DOMRect，包含坐标和尺寸信息
	 */
	getDocumentEndPosition = () => {
		const editor = this.instance?.editor
		if (!editor) return

		const { view, state } = editor
		// 获取文档末尾位置
		const lastPosition = Math.max(0, state.doc.content.size - 1)

		// 使用 TipTap 的 coordsAtPos API 直接获取文档末尾位置
		// 不需要临时聚焦，避免影响用户当前的光标位置
		const coords = view.coordsAtPos(lastPosition)
		if (!coords) return

		// 转换为类似 getBoundingClientRect() 的格式
		const height = coords.bottom - coords.top || 20

		return {
			left: coords.left,
			top: coords.top,
			right: coords.right,
			bottom: coords.bottom,
			width: coords.right - coords.left || 1,
			height,
			x: coords.left,
			y: coords.top,
		}
	}

	/**
	 * 获取当前光标的视图坐标位置
	 * 使用 TipTap 的 view.coordsAtPos API，即使编辑器未聚焦也能正确获取位置
	 * @returns 当前光标的DOMRect，包含坐标和尺寸信息
	 */
	getCurrentCursorPosition = () => {
		const editor = this.instance?.editor
		if (!editor) return

		const { view, state } = editor
		const { head } = state.selection

		// 使用 TipTap 的 coordsAtPos API 获取光标位置坐标
		// 这个方法不依赖 window.getSelection()，即使编辑器未聚焦也能正常工作
		const coords = view.coordsAtPos(head)
		if (!coords) return

		// 转换为类似 getBoundingClientRect() 的格式
		// 估算光标高度（通常为行高）
		const height = coords.bottom - coords.top || 20

		return {
			left: coords.left,
			top: coords.top,
			right: coords.right,
			bottom: coords.bottom,
			width: coords.right - coords.left || 1,
			height,
			x: coords.left,
			y: coords.top,
		}
	}

	/**
	 * 生成上下文信息（靠近光标）
	 */
	getContext = (): AIAutoCompletionContext | undefined => {
		const editor = this.instance?.editor
		if (!editor) return

		const state = editor.state
		const { from, to, head } = state.selection
		const doc = state.doc

		const prefix = doc.textBetween(0, head, "\u0000", "\n")
		const suffix = doc.textBetween(head, doc.content.size, "\u0000", "\n")

		const lastNewLineIdx = prefix.lastIndexOf("\n")
		const currentLinePrefix = lastNewLineIdx >= 0 ? prefix.slice(lastNewLineIdx + 1) : prefix

		const nextNewLineIdx = suffix.indexOf("\n")
		const currentLineSuffix = nextNewLineIdx >= 0 ? suffix.slice(0, nextNewLineIdx) : suffix

		return {
			prefix,
			suffix,
			cursor: head,
			selectionFrom: from,
			selectionTo: to,
			docSize: doc.content.size,
			currentLinePrefix,
			currentLineSuffix,
		}
	}

	getCurrentFingerprint = () => {
		const ctx = this.getContext()
		if (!ctx) return ""
		return this.buildContextFingerprint(ctx)
	}

	/**
	 * 触发获取AI建议词（带防抖）
	 * 由编辑器的 onUpdate 事件触发，当内容变化时调用
	 * 防抖处理避免频繁请求
	 */
	triggerFetchSuggestion = debounce(
		() => {
			// 如果插件未启用，不触发获取建议
			if (!this.enabled) return

			const editor = this.instance?.editor
			if (!editor) return

			// 检查是否有 loading 状态的 marker，如果有则不获取建议
			const hasLoadingMarker = this.checkHasLoadingMarker(editor)
			if (hasLoadingMarker) {
				return
			}

			const text = this.getText() || ""
			const context = this.getContext()

			if (!this.aiAutoCompletionOptions || this.composition) return

			const fingerprint = context ? this.getCurrentFingerprint() : ""

			// 去重：上下文优先
			if (fingerprint && fingerprint === this.lastRequestFingerprint) return
			if (!fingerprint && text === this.lastRequestText) return

			// 取消之前未完成的请求
			if (this.currentRequest) {
				// Remove detailed request cancellation logging - too frequent
				this.currentRequest.abort("trigger new request")
				this.currentRequest = null
			}

			this.lastRequestText = text
			this.lastRequestFingerprint = fingerprint

			this.currentRequest = new AbortController()

			let reqPromise: Promise<string> | undefined
			if (this.aiAutoCompletionOptions.fetchSuggestionWithContext) {
				reqPromise = this.aiAutoCompletionOptions.fetchSuggestionWithContext(
					context as AIAutoCompletionContext,
					this.currentRequest.signal,
				)
			} else if (this.aiAutoCompletionOptions.fetchSuggestion) {
				reqPromise = this.aiAutoCompletionOptions.fetchSuggestion(
					text,
					this.currentRequest.signal,
				)
			}

			reqPromise
				?.then((suggestion) => {
					logger.report("suggestion_lifecycle", {
						action: "fetch_success",
						textLength: text?.length || 0,
						suggestionLength: suggestion?.length || 0,
					})
					const editorOk = !!this.instance?.editor && !this.instance?.editor?.isEmpty
					const notAborted = !!this.currentRequest
					const sameCtx = fingerprint
						? this.getCurrentFingerprint() === fingerprint
						: this.getText() === text
					if (editorOk && !this.composition && sameCtx && notAborted) {
						this.updateSuggestion(suggestion)
						this.valueCache = this.getText() || ""
					}
				})
				.catch((e) => {
					// 忽略被取消的请求错误
					if (e.name !== "AbortError") {
						logger.report("error_tracking", {
							type: "fetch_suggestion_failed",
							error: e.message,
							errorName: e.name,
							textLength: text?.length || 0,
						})
						console.error("获取AI建议词失败:", e)
					}
					// Remove request aborted logging - too frequent
				})
				.finally(() => {
					if (this.currentRequest) this.currentRequest = null
				})
		},
		600,
		{ trailing: true },
	)
	insertSuggestion = ({
		editor,
		suggestionText,
	}: {
		editor: MagicRichEditorRef["editor"] | undefined
		suggestionText?: string
	}) => {
		if (!editor) return

		// 获取建议词
		const attr = editor.getAttributes("paragraph")
		let { suggestion } = attr

		if (suggestionText) {
			suggestion = suggestionText
		}

		// 加强检查，确保建议词有效
		// 只有在有有效建议词的情况下才执行操作
		if (suggestion && typeof suggestion === "string" && suggestion.trim().length > 0) {
			this.isInsertSuggestionChange = true
			editor.chain().focus().run()

			const currentPosition = editor.state.selection.head
			const endPosition = editor.state.doc.content.size - 1
			editor.commands.focus(endPosition)

			editor.commands.insertContent(suggestion)

			logger.report("suggestion_lifecycle", {
				action: "accept",
				suggestionLength: suggestion?.length || 0,
				cursorPosition: currentPosition,
			})

			// 增加Tab键点击次数
			this.addTabCount()

			const isNotLastPosition = currentPosition < endPosition
			if (isNotLastPosition) editor.commands.focus(currentPosition)

			this.clearSuggestion()
		}

		// 禁用Tab键默认行为
		return true
	}

	/**
	 * 检查编辑器中是否有 loading 状态的 marker
	 * @param editor 编辑器实例
	 * @returns 是否有 loading 状态的 marker
	 */
	private checkHasLoadingMarker = (editor: MagicRichEditorRef["editor"]): boolean => {
		if (!editor) return false

		let hasLoading = false
		const { state } = editor.view

		// 遍历文档中的所有节点，查找 loading 状态的 marker
		state.doc.descendants((node) => {
			if (hasLoading) return false // 如果已经找到，停止遍历

			if (node.type.name === "mention") {
				const attrs = node.attrs as {
					type?: string
					data?: unknown
				}

				// 检查是否是 DESIGN_MARKER 类型
				if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
					const markerData = attrs.data as CanvasMarkerMentionData
					// 检查是否处于 loading 状态
					if (markerData?.loading === true) {
						hasLoading = true
						return false // 找到后停止遍历
					}
				}
			}

			return true // 继续遍历
		})

		return hasLoading
	}

	/**
	 * 启用插件
	 * 开启AI自动补全功能
	 */
	enable = () => {
		if (this.enabled) return
		this.enabled = true
		logger.report("plugin_lifecycle", { action: "enabled" })
	}

	/**
	 * 禁用插件
	 * 关闭AI自动补全功能，并清除当前建议
	 */
	disable = () => {
		if (!this.enabled) return
		this.enabled = false
		this.clearSuggestion()
		logger.report("plugin_lifecycle", { action: "disabled" })
	}

	/**
	 * 获取插件启用状态
	 * @returns 插件是否启用
	 */
	isEnabled = () => {
		return this.enabled
	}

	/**
	 * 获取编辑器扩展
	 * 在初始化编辑器时调用，添加AI补全相关的功能
	 * @returns 用于TipTap编辑器的扩展
	 */
	getExtension = (options?: AIAutoCompletionExtensionOptions) => {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this

		this.aiAutoCompletionOptions = options ?? this.aiAutoCompletionOptions

		return Extension.create<
			AIAutoCompletionExtensionOptions | undefined,
			{ valueCache: string }
		>({
			name: "ai-auto-completion",

			// 设置高优先级，确保在其他扩展之前处理
			priority: 1000,

			// 添加全局属性，用于存储建议词
			addGlobalAttributes() {
				return [
					{
						types: ["paragraph"],
						attributes: {
							suggestion: {
								default: "",
								parseHTML: (element) => {
									return element.getAttribute("data-suggestion") ?? ""
								},
								renderHTML: (attrs) => {
									return { "data-suggestion": attrs.suggestion }
								},
							},
						},
					},
				]
			},

			// 添加ProseMirror插件，处理事务和状态更新
			addProseMirrorPlugins() {
				return [
					new Plugin({
						// 处理事务并维护历史记录状态
						appendTransaction: (
							transactions: readonly Transaction[],
							_: EditorState,
							newState: EditorState,
						) => {
							// 检查是否有历史操作（撤销/重做）
							const hasHistoryOp = transactions.some(
								(tr) => tr.getMeta("isUndoing") || tr.getMeta("isRedoing"),
							)

							if (hasHistoryOp) {
								// 如果插件未启用，不处理历史操作恢复
								if (!self.enabled) {
									return null
								}

								// 标记为历史操作，稍后恢复建议词
								self.isHistoryOperation = true

								// Remove detailed history operation logging - internal behavior

								// 在撤销/重做后，使用异步方式恢复建议词
								setTimeout(() => {
									// 恢复建议词但不参与历史
									if (
										self.enabled &&
										self.isHistoryOperation &&
										self.currentSuggestion
									) {
										const editor = self.instance?.editor
										if (editor) {
											// Remove restore logging - internal operation

											// 使用 chain API 恢复建议词，确保不记录历史
											editor
												.chain()
												.command(({ tr }) => {
													tr.setMeta("addToHistory", false)
													tr.setMeta("suggestionUpdate", true)
													return true
												})
												.updateAttributes("paragraph", {
													suggestion: self.currentSuggestion,
												})
												.run()
											AiCompletionStore.setSuggestion(self.currentSuggestion)
										}
										self.isHistoryOperation = false
									}
								}, 0)
							}

							// 检查是否是建议词更新事务，确保这类事务不影响历史
							if (transactions.some((tr) => tr.getMeta("suggestionUpdate"))) {
								return newState.tr.setMeta("addToHistory", false)
							}

							return null
						},
					}),
				]
			},

			// 监控事务，标记历史操作
			onTransaction({ transaction }) {
				if (transaction.getMeta("isUndoing") || transaction.getMeta("isRedoing")) {
					// Remove transaction logging - too technical and frequent
					self.isHistoryOperation = true
				}
			},

			/**
			 * 监控编辑器内容更新，触发获取建议
			 * 当用户输入内容时自动触发
			 */
			onUpdate() {
				// 如果插件未启用，跳过处理
				if (!self.enabled) return

				// 如果正在执行清理操作，跳过处理
				if (self.isClear) {
					self.isClear = false
					return
				}

				const editor = self.instance?.editor
				if (!editor) return

				const text = self.getText()

				// 对于插入提示词导致的变更，不触发获取建议
				if (self.isInsertSuggestionChange) {
					self.isInsertSuggestionChange = false
					return
				}

				// 只有满足以下条件才触发获取建议：
				// 1. 有文本内容
				// 2. 文本内容发生变化
				// 3. 不在输入法组合状态
				if (text !== self.valueCache && !self.composition && !self.isHistoryOperation) {
					self.triggerFetchSuggestion()
				}
			},

			// 选择变化时清理提示，避免跨选区错误展示
			onSelectionUpdate() {
				if (!self.enabled) return
				if (self.currentRequest) {
					self.currentRequest.abort("selection update")
					self.currentRequest = null
				}
				AiCompletionTip.hide()
			},

			// 编辑器失焦时，清除建议
			onBlur() {
				if (!self.enabled) return
				// Remove editor blur logging - not critical for user behavior analysis
				setTimeout(() => {
					if (self.valueCache) {
						self.clearSuggestion()
					}
				}, 100)
			},

			// 添加键盘快捷键处理，Tab键接受建议
			addKeyboardShortcuts() {
				return {
					Tab: ({ editor }) => {
						if (!self.enabled) return false
						self.insertSuggestion({ editor })
						return true
					},
					Escape: () => {
						if (!self.enabled) return false
						self.clearSuggestion()
						return true
					},
				}
			},
		})
	}

	/**
	 * 获取编辑器当前文本内容
	 * 被多个函数调用，用于获取当前编辑器内容
	 * @returns 文本内容
	 */
	getText = () => {
		return this.instance?.editor?.getText()
	}

	/**
	 * 清除建议词和相关状态
	 * 在接受建议、取消建议或编辑器失焦时调用
	 */
	clearSuggestion = () => {
		// Remove clear suggestion logging - too frequent, internal operation
		this.isClear = true
		this.valueCache = ""
		this.currentSuggestion = ""
		this.lastRequestText = ""

		// 取消任何正在进行的请求
		if (this.currentRequest) {
			this.currentRequest.abort("clear suggestion")
			this.currentRequest = null
		}

		// 确保编辑器存在
		const editor = this.instance?.editor
		if (editor) {
			// 使用 chain API 清除段落属性中的建议词，确保不加入历史记录
			editor
				.chain()
				.command(({ tr }) => {
					tr.setMeta("addToHistory", false)
					tr.setMeta("suggestionUpdate", true)
					return true
				})
				.updateAttributes("paragraph", { suggestion: "" })
				.run()
			AiCompletionStore.clearSuggestion()
		}

		// 隐藏提示，不再通过updateSuggestion间接调用
		AiCompletionTip.hide()
	}

	/**
	 * 处理输入法组合开始事件（如中文输入）
	 * 当用户开始使用输入法输入时触发
	 */
	onCompositionStart = () => {
		if (!this.enabled) return
		this.composition = true
		this.clearSuggestion()
	}

	/**
	 * 处理输入法组合结束事件
	 * 当用户完成输入法输入时触发，重新开始获取建议
	 */
	onCompositionEnd = () => {
		if (!this.enabled) return
		this.composition = false
		// 添加小延迟确保composition状态完全稳定
		setTimeout(() => {
			// 再次检查composition状态，确保没有新的composition开始
			if (!this.composition) {
				// Remove detailed trigger logging - redundant with fetch success
				this.triggerFetchSuggestion()
			}
		}, 50)
	}
}

// 导出单例实例
export default new AiCompletionService()
