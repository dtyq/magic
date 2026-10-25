import type { LayerElement } from "../../runtime/document/types"

export type LayerTreeData = LayerElement &
	Record<string, unknown> & {
		/** 展示名称可能包含运行时后缀，编辑时必须使用不带后缀的真实名称。 */
		editableName?: string
	}
