/**
 * 命令接口
 */
export interface ICommand {
	/** 命令唯一ID */
	id: string
	/** 命令类型 */
	type: string
	/** 命令描述 */
	description: string
	/** 创建时间戳 */
	timestamp: number

	/**
	 * 执行命令
	 */
	execute(): Promise<void> | void

	/**
	 * 撤销命令
	 */
	undo(): Promise<void> | void

	/**
	 * 是否可撤销
	 */
	canUndo(): boolean
}

/**
 * 命令基类
 */
export abstract class BaseCommand implements ICommand {
	public id: string
	public type: string
	public description: string
	public timestamp: number

	constructor(id: string, type: string, description: string) {
		this.id = id
		this.type = type
		this.description = description
		this.timestamp = Date.now()
	}

	abstract execute(): Promise<void> | void
	abstract undo(): Promise<void> | void

	canUndo(): boolean {
		return true
	}
}

/**
 * 样式命令类型
 */
export enum StyleCommandType {
	SET_STYLE = "SET_STYLE",
	SET_BACKGROUND_COLOR = "SET_BACKGROUND_COLOR",
	SET_TEXT_COLOR = "SET_TEXT_COLOR",
	SET_FONT_SIZE = "SET_FONT_SIZE",
	SET_FONT_WEIGHT = "SET_FONT_WEIGHT",
	BATCH_STYLES = "BATCH_STYLES",
	UPDATE_TEXT_CONTENT = "UPDATE_TEXT_CONTENT",
}

/**
 * 设置样式命令
 */
export class SetStyleCommand extends BaseCommand {
	private element: HTMLElement
	private styleProperty: string
	private newValue: string
	private oldValue: string

	constructor(id: string, element: HTMLElement, property: string, value: string) {
		const tagName = element.tagName.toLowerCase()
		super(id, StyleCommandType.SET_STYLE, `设置 ${tagName} 的 ${property} 为 ${value}`)

		this.element = element
		this.styleProperty = property
		this.newValue = value
		this.oldValue = element.style.getPropertyValue(property) || ""
	}

	execute(): void {
		this.element.style.setProperty(this.styleProperty, this.newValue)
	}

	undo(): void {
		if (this.oldValue) {
			this.element.style.setProperty(this.styleProperty, this.oldValue)
		} else {
			this.element.style.removeProperty(this.styleProperty)
		}
	}
}

/**
 * 批量样式命令
 */
export class BatchStyleCommand extends BaseCommand {
	private commands: SetStyleCommand[]

	constructor(id: string, commands: SetStyleCommand[]) {
		super(id, StyleCommandType.BATCH_STYLES, `批量设置样式（${commands.length}个）`)
		this.commands = commands
	}

	async execute(): Promise<void> {
		for (const cmd of this.commands) {
			await cmd.execute()
		}
	}

	async undo(): Promise<void> {
		// 逆序撤销
		for (let i = this.commands.length - 1; i >= 0; i--) {
			await this.commands[i].undo()
		}
	}
}

/**
 * 更新文本内容命令
 */
export class UpdateTextContentCommand extends BaseCommand {
	private element: HTMLElement
	private newContent: string
	private oldContent: string

	constructor(id: string, element: HTMLElement, content: string) {
		const tagName = element.tagName.toLowerCase()
		super(id, StyleCommandType.UPDATE_TEXT_CONTENT, `更新 ${tagName} 的文本内容`)

		this.element = element
		this.newContent = content
		this.oldContent = element.textContent || ""
	}

	execute(): void {
		this.element.textContent = this.newContent
	}

	undo(): void {
		this.element.textContent = this.oldContent
	}
}

/**
 * 命令历史记录
 */
export interface CommandHistoryEntry {
	command: ICommand
	executedAt: number
}
