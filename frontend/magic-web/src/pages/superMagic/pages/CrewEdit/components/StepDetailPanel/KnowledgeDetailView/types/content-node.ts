import type { Knowledge } from "@/types/knowledge"

export interface ContentNode {
	/** 节点唯一标识符 */
	id: number

	/** 节点内容类型 */
	type: Knowledge.DocumentNodeType

	/** 层级深度（-1表示非标题内容，0+表示标题层级） */
	level: number

	/** 父节点ID（-1表示根节点） */
	parent: number

	/** 节点文本内容 */
	text: string

	/** 子节点ID数组 */
	children: number[]
}

export type DocumentNodes = ContentNode[]
