import { computed, makeAutoObservable } from "mobx"
import type { JSONContent } from "@tiptap/core"
import { cloneDeep, isObject, omit } from "lodash-es"
import type {
	SelectorQuickInstruction,
	SwitchQuickInstruction,
	TextQuickInstruction,
	QuickInstruction,
	StatusQuickInstruction,
	QuickInstructionList,
	SystemInstruct,
	InstructionGroupType,
	Bot,
} from "@/opensource/types/bot"
import { InstructionMode, InstructionType } from "@/opensource/types/bot"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"
import { InsertLocationMap } from "@/opensource/pages/flow/components/QuickInstructionButton/const"
import type { ConversationMessageInstruct } from "@/opensource/types/chat/conversation_message"
import {
	replaceExistQuickInstruction,
	transformQuickInstruction,
} from "@/opensource/pages/chatNew/components/quick-instruction/utils"
import { ChatApi } from "@/opensource/apis"

export interface InstructConfigUpdateParams {
	instructs?: Record<string, unknown>
}

export interface InstructUpdateCallback {
	(params: InstructConfigUpdateParams): Promise<{ instructs?: Record<string, unknown> }>
}

export interface ConversationBotDataManagerProps {
	// 编辑器相关
	editorRef?: MagicRichEditorRef | null
	onSend?: (
		content: JSONContent | undefined,
		onlyTextContent: boolean,
		isLongMessage?: boolean,
	) => Promise<void> | undefined
}

/**
 * 会话机器人数据管理器
 */
class ConversationBotDataService {
	// 编辑器相关
	editorRef?: MagicRichEditorRef | null

	onSend?: (
		content: JSONContent | undefined,
		onlyTextContent: boolean,
		isLongMessage?: boolean,
	) => Promise<void> | undefined

	// BotProvider相关数据
	conversationId?: string

	// 用户ID
	userId?: string

	// 机器人ID
	agentId?: string

	/* 机器人名字 */
	agentName?: string

	// 获取机器人信息loading
	isfetchBotInfoLoading: boolean = false

	// 快捷指令列表
	instructions?: QuickInstructionList[]

	// 快捷指令配置
	innerInstructConfig?: Record<string, unknown>

	// 临时快捷指令配置, 该配置在用户刷新后失效
	sessionInstructConfig?: Record<string, unknown>

	// 是否展示开始页面
	startPage?: boolean

	// 更新快捷指令配置loading
	isUpdateConversationInstructionConfigLoading: boolean = false

	// 获取快捷指令配置loading
	isFetchConversationInstructionConfigLoading: boolean = false

	get instructConfig() {
		return {
			...this.innerInstructConfig,
			...this.sessionInstructConfig,
		}
	}

	/**
	 * 获取快捷指令
	 * @param position 位置
	 * @returns 快捷指令
	 */
	getQuickInstructionsByPosition(position: InstructionGroupType) {
		return this.instructions?.find((instruction) => instruction.position === position)
	}

	constructor(props?: ConversationBotDataManagerProps) {
		// 编辑器相关
		this.editorRef = props?.editorRef
		this.onSend = props?.onSend
		makeAutoObservable(
			this,
			{
				residencyContent: computed,
				onSend: false,
			},
			{ autoBind: true },
		)
	}

	/**
	 * 更新属性
	 */
	updateProps(props: ConversationBotDataManagerProps) {
		this.editorRef = props?.editorRef
		this.onSend = props?.onSend
	}

	/**
	 * 获取常驻内容
	 * @returns
	 */
	get residencyContent() {
		const result: JSONContent[] = []
		if (!this.instructConfig) return result
		const insList = this.instructions?.map((i) => i.items).flat()
		Object.entries(this.instructConfig).forEach(([key, value]) => {
			const ins = insList?.find((i) => i.id === key)
			if (!ins) return
			if (!ins.residency) return
			switch (ins.type) {
				case InstructionType.SINGLE_CHOICE:
					console.log("ins.content", ins)
					let item = transformQuickInstruction(JSON.parse(ins.content ?? "[]"), (c) => {
						c.attrs = {
							instruction: ins,
							value,
						}
					}) as JSONContent[]

					if (!Array.isArray(item)) {
						item = [item]
					}

					result.push(...item)
					break
				default:
					break
			}
		})

		return result
	}

	/**
	 * 初始化时，插入常驻快捷指令
	 */
	insertResidencyQuickInstructionWhenInit() {
		const jsonContent = this.editorRef?.editor?.getText()
		// 如果内容不为空，则不插入
		if (jsonContent) return

		// 检查编辑器是否已挂载
		if (!this.editorRef?.editor?.view) return

		this.editorRef?.editor?.chain().insertContent(this.residencyContent).run()
		// 安全地调用 focus，只在视图存在时执行
		if (this.editorRef?.editor?.view) {
			this.editorRef?.editor?.chain().focus().run()
		}
	}

	/**
	 * 更新快捷指令配置
	 * @param instructs 快捷指令配置
	 */
	updateRemoteInstructionConfig(instructs: Record<string, unknown>, remove?: boolean) {
		if (!this.conversationId || !this.userId)
			return Promise.reject(new Error("会话ID或用户ID为空"))

		this.isUpdateConversationInstructionConfigLoading = true

		return ChatApi.updateAiConversationQuickInstructionConfig({
			conversation_id: this.conversationId,
			receive_id: this.userId,
			instructs,
		})
			.then(({ instructs: instructs_list }) => {
				if (remove) {
					this.innerInstructConfig = omit(
						this.innerInstructConfig,
						Object.keys(instructs),
					)
				} else {
					this.innerInstructConfig = {
						...this.innerInstructConfig,
						...instructs_list,
					}
				}
			})
			.finally(() => {
				this.isUpdateConversationInstructionConfigLoading = false
			})
	}

	/**
	 * 清除机器人信息
	 */
	clearBotInfo() {
		// 清除机器人信息
		this.instructions = []
		this.startPage = false
		this.innerInstructConfig = {}
		this.sessionInstructConfig = {}
		this.isFetchConversationInstructionConfigLoading = false
		this.isUpdateConversationInstructionConfigLoading = false
		this.isfetchBotInfoLoading = false
	}

	/**
	 * 更新属性
	 */
	switchConversation(
		conversationId: string,
		userId: string,
		botInfo: Bot.Detail["botEntity"],
		instructConfig?: Record<string, unknown>,
	) {
		// 清除旧的机器人信息
		this.clearBotInfo()

		// 更新新的机器人信息
		this.conversationId = conversationId
		this.userId = userId
		this.innerInstructConfig = instructConfig
		this.initBotInfo(botInfo)
	}

	/**
	 * 初始化机器人信息
	 * @param data 机器人信息
	 */
	initBotInfo(data: Bot.Detail["botEntity"]) {
		this.instructions = data.instructs
		this.startPage = data.start_page
		this.agentId = data.root_id
		this.agentName = data.robot_name
		this.insertResidencyQuickInstructionWhenInit()
	}

	/**
	 * 更新会话快捷指令配置
	 */
	updateConversationInstructConfig(instructConfig: Record<string, unknown>) {
		this.innerInstructConfig = instructConfig
	}

	/**
	 * 往 JSON 数据中插入开关快捷指令
	 */
	enhanceJsonContentBaseSwitchInstruction(jsonContent?: JSONContent): JSONContent | undefined {
		if (!jsonContent) return jsonContent
		if (isObject(jsonContent)) {
			const instructMap = this.instructions?.map((item) => item.items).flat()

			// 没有配置快捷指令，直接返回
			if (!instructMap) return jsonContent

			let container

			if (
				jsonContent.content?.[0] &&
				jsonContent.content?.[0].content &&
				Array.isArray(jsonContent.content?.[0].content)
			) {
				container = jsonContent.content?.[0].content
			} else if (jsonContent.content && Array.isArray(jsonContent.content)) {
				container = jsonContent.content
			}

			if (container) {
				// 获取默认配置
				const defaultConfig = instructMap.reduce(
					(acc, cur) => {
						if (cur.type === InstructionType.SWITCH) {
							acc[cur.id] = cur.default_value
						}
						return acc
					},
					{} as Record<string, unknown>,
				)

				// 合并默认配置和用户配置
				Object.entries({ ...defaultConfig, ...this.instructConfig })
					.reverse()
					.forEach(([instructId, value]) => {
						const ins = instructMap?.find((i) => i.id === instructId) as
							| Exclude<QuickInstruction, SystemInstruct>
							| undefined

						// 如果指令不存在,则不插入
						if (!ins) return

						// 如果指令是文本指令或状态指令,则不插入
						if (
							[
								InstructionType.TEXT,
								InstructionType.STATUS,
								InstructionType.SINGLE_CHOICE,
							].includes(ins.type)
						)
							return

						// 如果指令是流程指令,则不插入
						if (ins.instruction_type === InstructionMode.Flow) return

						// 开关指令，只有值为 on 的时候才需要插入
						if (ins.type === InstructionType.SWITCH && value !== "on") return

						// 开关指令，不拼接 content 内容，由后端拼接
						const content = [
							{
								type: "quick-instruction",
								attrs: {
									instruction: ins,
									value,
								},
							},
						]

						// 如果指令插入位置为头部，则插入头部
						switch (ins.insert_location) {
							case InsertLocationMap.Behind:
								container?.push(...content)
								break
							case InsertLocationMap.Before:
							default:
								container?.unshift(...content)
								break
						}
					})

				return cloneDeep(jsonContent)
			}
			return jsonContent
		}
		return jsonContent
	}

	/**
	 * 生成流程指令数据
	 * @returns
	 */
	genFlowInstructs() {
		return cloneDeep(
			Object.entries(this.instructConfig)
				.map(([k, v]) => {
					const ins = this.instructions
						?.map((i) => i.items)
						.flat()
						.find((i) => i.id === k)

					if (!ins) return undefined

					if (ins.instruction_type === InstructionMode.Chat) return undefined

					switch (ins.type) {
						case InstructionType.SWITCH:
							return {
								value: v,
								instruction: ins,
							}
						case InstructionType.SINGLE_CHOICE:
							return {
								value: v,
								instruction: ins,
							}
						case InstructionType.STATUS:
							return {
								value: v,
								instruction: ins,
							}
						default:
							return undefined
					}
				})
				.filter(Boolean) as ConversationMessageInstruct[],
		)
	}

	/**
	 * 根据指定位置插入内容
	 * @param insertContent 要插入的内容
	 * @param insertLocation 插入位置
	 */
	insertContentByLocation(insertContent: JSONContent[], insertLocation?: InsertLocationMap) {
		if (!insertContent.length) return

		switch (insertLocation) {
			case InsertLocationMap.Before:
				// 插入到第一个位置，0 会导致换行
				this.editorRef?.editor?.chain().focus().insertContentAt(1, insertContent).run()
				break
			case InsertLocationMap.Behind:
				// 获取文档末尾位置，而不是选择范围的结束位置
				const docSize = this.editorRef?.editor?.state.doc.content.size
				if (docSize === undefined) {
					// 如果无法获取文档大小，直接插入内容
					this.editorRef?.editor?.chain().focus().insertContent(insertContent).run()
				} else {
					// 根据文档大小计算末尾位置，确保位置有效
					const docEndPosition = Math.max(0, docSize - 1)
					this.editorRef?.editor
						?.chain()
						.focus()
						.insertContentAt(docEndPosition, insertContent)
						.run()
				}
				break
			case InsertLocationMap.Cursor:
				const currentPos = this.editorRef?.editor?.state.selection.$anchor
				if (!currentPos) {
					this.editorRef?.editor?.chain().focus().insertContent(insertContent).run()
				} else {
					this.editorRef?.editor
						?.chain()
						.focus()
						.insertContentAt(currentPos.pos, insertContent)
						.run()
				}
				break
			default:
				// 默认情况下直接在当前位置插入
				this.editorRef?.editor?.chain().focus().insertContent(insertContent).run()
				break
		}
	}

	/**
	 * 更新快捷指令配置
	 * @param instruction 快捷指令
	 * @param targetId 目标ID
	 */
	updateInstructionConfig(instruction: QuickInstruction, targetId: string) {
		if (instruction.residency) {
			return this.updateRemoteInstructionConfig?.({
				[instruction.id]: targetId,
			})
		}
		this.sessionInstructConfig = {
			...this.sessionInstructConfig,
			[instruction.id]: targetId,
		}
		return Promise.resolve()
	}

	/** 选择类型 */
	handleSelectorQuickInstructionClick(targetId: string, instruction: SelectorQuickInstruction) {
		// 更新快捷指令配置
		this.updateInstructionConfig(instruction, targetId)

		// 如果是流程指令，则更新值
		if (instruction.instruction_type === InstructionMode.Flow) {
			return
		}

		// 如果需要直接发送, 并且指令不是常驻的, 则发送
		if (instruction?.send_directly && !instruction.residency) {
			const contentWithWrapper = {
				type: "doc",
				content: transformQuickInstruction(JSON.parse(instruction.content ?? "[]"), (c) => {
					c.attrs = {
						instruction,
						value: targetId,
					}
				}) as JSONContent[],
			}

			this.onSend?.(this.enhanceJsonContentBaseSwitchInstruction(contentWithWrapper), false)
			return
		}

		// 替换存在指令
		const jsonContent = this.editorRef?.editor?.getJSON() ?? {}
		const replaceStatus = replaceExistQuickInstruction(
			jsonContent,
			(attrs) => {
				if (!attrs) return false
				return (attrs?.instruction as QuickInstruction)?.id === instruction.id
			},
			targetId,
		)

		// 替换成功,更新内容
		if (replaceStatus) {
			this.editorRef?.editor?.chain().clearContent().run()
			this.editorRef?.editor?.chain().focus().insertContent(jsonContent).run()
		} else {
			let insertContent = transformQuickInstruction(
				JSON.parse(instruction.content ?? "[]"),
				(c) => {
					c.attrs = {
						instruction,
						value: targetId,
					}
				},
			) as JSONContent[]

			if (!Array.isArray(insertContent)) {
				insertContent = [insertContent]
			}

			// 调用统一的插入方法
			this.insertContentByLocation(insertContent, instruction.insert_location)
		}
	}

	/**
	 * 从配置中移除快捷指令的值
	 * @param instruction 快捷指令
	 */
	removeSelectorValueFromConfig(instruction: SelectorQuickInstruction) {
		if (instruction.residency) {
			return this.updateRemoteInstructionConfig?.(
				{
					[instruction.id]: "",
				},
				true,
			)
		}

		this.sessionInstructConfig = {
			...this.sessionInstructConfig,
			[instruction.id]: "",
		}
		return Promise.resolve()
	}

	/**
	 * 清除快捷指令配置
	 */
	clearSessionInstructConfig() {
		this.sessionInstructConfig = {}
	}

	/**
	 * 开关类型
	 * @param value 值
	 * @param instruction 快捷指令
	 */
	handleSwitchQuickInstructionClick(value: string, instruction: SwitchQuickInstruction) {
		return this.updateInstructionConfig(instruction, value)
	}

	/** 文本类型 */
	handleTextQuickInstructionClick(value: string, instruction: TextQuickInstruction) {
		try {
			const content = JSON.parse(value)
			const insertContent = Array.isArray(content) ? content : [content]

			console.log("insertContent", insertContent)

			if (instruction?.send_directly) {
				const jsonWithWrapper = {
					type: "doc",
					content: insertContent,
				}
				this.onSend?.(this.enhanceJsonContentBaseSwitchInstruction(jsonWithWrapper), false)
			} else {
				// 调用统一的插入方法
				this.insertContentByLocation(insertContent, instruction.insert_location)
			}
		} catch (err) {
			console.error("快捷指令内容解析失败", instruction)
		}
	}

	/** 状态类型 */
	handleStatusQuickInstructionClick(
		value: string,
		instruction: StatusQuickInstruction,
		currentId: string,
	) {
		return this.updateRemoteInstructionConfig?.({
			[instruction.id]: currentId,
		}).then(() => {
			try {
				const jsonWithWrapper = {
					type: "doc",
					content: [{ type: "text", text: value }],
				}
				this.onSend?.(this.enhanceJsonContentBaseSwitchInstruction(jsonWithWrapper), false)
			} catch (err) {
				console.error("快捷指令内容解析失败", instruction)
			}
		})
	}
}

export default new ConversationBotDataService()
