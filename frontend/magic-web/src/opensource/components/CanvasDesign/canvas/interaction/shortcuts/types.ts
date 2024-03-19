/** 快捷键修饰符（平台特定） */
export type ShortcutModifier = "ctrl" | "shift" | "alt" | "meta"

/** 平台特定修饰键 */
export type PlatformModifier = "meta" | "ctrl" | "shift" | "alt"

/** 跨平台修饰键别名 */
export type ModifierAlias = "mod" | "shift" | "alt"

/** 完整的快捷键定义 */
export interface ShortcutDefinition {
	/** 快捷键唯一标识 */
	id: string
	/** 快捷键名称（用于显示） */
	name: string
	/** 主键 */
	key: string
	/** 修饰键（使用别名） */
	modifiers?: ModifierAlias[]
	/** 分类 */
	category: "tool" | "edit" | "view" | "selection" | "frame"
	/** 是否阻止默认行为 */
	preventDefault?: boolean
	/** 是否为临时快捷键（按住生效，释放恢复） */
	isTemporary?: boolean
	/** 描述 */
	description?: string
}
