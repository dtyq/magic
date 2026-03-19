import { ModeItem } from "@/pages/superMagic/pages/Workspace/types"
import { MessageEditorSize } from "../../types"

export type { MessageEditorSize }

export interface ModelConfig {
	max_tokens: number | null
	support_function: boolean
	support_deep_think: boolean
	vector_size: number
	support_multi_modal: boolean
	support_embedding: boolean
}

export interface ProviderItem {
	name: string
	icon: string
	sort: number
	recommended: boolean
}

/**
 * 模型标签
 */
export const enum ModelTagEnum {
	VIP = "VIP",
}

/**
 * 模型状态
 */
export const enum ModelStatusEnum {
	/** 正常 */
	Normal = "normal",
	/** 禁用 */
	Disabled = "disabled",
	/** 删除 */
	Deleted = "deleted",
}

export interface ModelItem {
	id: string
	group_id: string
	model_id: string
	model_name: string
	provider_model_id: string
	model_description: string
	model_icon: string
	model_status: ModelStatusEnum
	sort: number
	tags?: ModelTagEnum[]
}

export interface ModelSwitchProps {
	size?: MessageEditorSize
	selectedModel?: ModelItem | null
	modelList: ModeItem["groups"]
	onModelChange?: (model: ModelItem | null) => void
	onBeforeOpen?: () => Promise<void> | void
	selectedImageModel?: ModelItem | null
	imageModelList?: ModeItem["groups"]
	onImageModelChange?: (model: ModelItem | null) => void
	openAddModelMenuSignal?: number
	showName?: boolean
	showBorder?: boolean
	isLoading?: boolean
	className?: string
	placement?: "top" | "topLeft" | "topRight" | "bottom" | "bottomLeft" | "bottomRight"
	showLabel?: boolean
	/** Whether add model button is allowed (hidden on mobile when false) */
	editable?: boolean
	onAddModel?: (modelType: "text" | "image") => void
}

/**
 * 模式分组信息
 */
export interface ModeModelGroup {
	id: string
	mode_id: string
	icon: string
	color: string
	name: string
	description: string
	sort: number
	status: boolean
	created_at: string
}

/**
 * 模型列表分组
 */
export type ModelListGroup = ModeItem["groups"][number]
