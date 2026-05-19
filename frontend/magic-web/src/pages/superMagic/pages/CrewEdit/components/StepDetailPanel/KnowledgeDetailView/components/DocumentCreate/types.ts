import type { ComponentType } from "react"
import type { DocumentType } from "./constants"
import type { DocumentCreateStore } from "./store"
import type { Step } from "./components"

/**
 * DocumentCreate 组件 Props
 */
export interface DocumentCreateProps {
	knowledgeCode: string
	documentType: DocumentType
	knowledgeName?: string
	editMode?: boolean
	editDocumentCode?: string | null
	onComplete?: () => void
	onCancel?: () => void
}

/**
 * 步骤组件通用 Props 基础接口
 */
export interface StepComponentBaseProps<TStore = any> {
	store: TStore
	onNext: () => void
	onPrevious: () => void
}

/**
 * 步骤组件配置
 */
export interface StepComponentConfig {
	component: ComponentType<StepComponentBaseProps>
	storeKey: keyof Pick<
		DocumentCreateStore,
		"customContentStore" | "projectDocumentStore" | "wikiDocumentStore" | "localDocumentStore"
	>
}

/**
 * 步骤组件注册表类型
 */
export type StepRegistry = Record<DocumentType, Record<number, StepComponentConfig>>

/**
 * StepRenderer 组件 Props
 */
export interface StepRendererProps {
	documentType: DocumentType
	currentStep: number
	store: DocumentCreateStore
	onNext: () => void
	onPrevious: () => void
}

/**
 * ErrorView 组件 Props
 */
export interface ErrorViewProps {
	message: string
	description?: string
}

/**
 * DocumentCreate 导航回调集合
 */
export interface DocumentCreateNavigation {
	handleNext: () => void
	handlePrevious: () => void
	handleBack: () => void
	handleClose: () => void
	handleComplete: () => void
}
