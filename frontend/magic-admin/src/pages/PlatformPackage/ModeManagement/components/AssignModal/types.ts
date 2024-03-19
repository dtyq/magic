import type { LabeledValue } from "antd/es/select"
import type { AiManage } from "@/types/aiManage"
import { PlatformPackage } from "@/types/platformPackage"

export enum DragType {
	/* 左侧模型 */
	LeftModel = "leftModel",
	/* 模型 */
	Model = "model",
	/* 分组 */
	Group = "group",
	/* 子分组 */
	SubGroup = "subGroup",
	/* 子模型 */
	SubModel = "subModel",
}

export interface DragState {
	/* 活动项ID */
	activeId: string | null
	/* 目标项ID */
	overId: string | null
	/* 活动项类型 */
	activeType: DragType | null
	/* 目标项类型 */
	overType: DragType | null
	/* 目标项容器ID */
	overGroupId: string | null
	/* 目标项 */
	overItem: PlatformPackage.ModelItem | PlatformPackage.ModeGroup | null
	/* 活动项 */
	activeItem: AiManage.ModelInfo | PlatformPackage.ModelItem | PlatformPackage.ModeGroup | null
	/* 是否在目标项下方 */
	isBelowOverItem: boolean
	/* 是否按住 Shift 键, 放入模式 */
	isInsertMode: boolean
}

export interface State {
	distributionMethod: PlatformPackage.DistributionType
	flowMode: LabeledValue | null
}

export const defaultDragState: DragState = {
	activeId: null,
	overId: null,
	activeType: null,
	overType: null,
	overGroupId: null,
	overItem: null,
	activeItem: null,
	isBelowOverItem: false,
	isInsertMode: false,
}

export const defaultState: State = {
	distributionMethod: PlatformPackage.DistributionType.Independent,
	flowMode: null,
}

export interface GroupItem {
	group: PlatformPackage.ModeGroup
	models: Map<string, PlatformPackage.ModelItem>
}
