import { memo, Suspense } from "react"
import { STEP_COMPONENT_REGISTRY } from "../config/step-registry"
import type { StepRendererProps } from "../types"
import { StepLoadingSkeleton } from "./StepLoadingSkeleton"

/**
 * 统一的步骤渲染组件
 *
 * 根据文档类型和当前步骤，从注册表中选择对应的组件进行渲染
 * 使用 Suspense 支持动态导入的步骤组件
 *
 * @param documentType - 文档类型
 * @param currentStep - 当前步骤编号
 * @param store - DocumentCreateStore 实例
 * @param onNext - 下一步回调
 * @param onPrevious - 上一步回调
 */
export const StepRenderer = memo(function StepRenderer({
	documentType,
	currentStep,
	store,
	onNext,
	onPrevious,
}: StepRendererProps) {
	// 编辑模式下，实际步骤号需要 +1（因为跳过了第一步）
	const actualStep = store.editMode ? currentStep + 1 : currentStep
	const config = STEP_COMPONENT_REGISTRY[documentType]?.[actualStep]

	if (!config) {
		console.warn(
			`No component found for ${documentType} step ${actualStep} (display step ${currentStep}, editMode: ${store.editMode})`,
		)
		return null
	}

	const StepComponent = config.component
	const stepStore = store[config.storeKey]

	// 为特定步骤传递额外的 props
	const extraProps: {
		editMode?: boolean
		editDocumentCode?: string | null
		showPrevious?: boolean
		knowledgeCode?: string
	} = {}

	// DataProcessingStep 需要 editMode, editDocumentCode 和 knowledgeCode
	const isDataProcessingStep =
		(documentType === "local" && actualStep === 4) ||
		(documentType === "custom" && actualStep === 3) ||
		(documentType === "project" && actualStep === 3) ||
		(documentType === "wiki" && actualStep === 3)

	// Wiki / Project 第 1 步：编辑已有文档配置时通过 editDocumentCode 放宽校验
	const isWikiOrProjectSelectionStep =
		(documentType === "wiki" && actualStep === 1) ||
		(documentType === "project" && actualStep === 1)

	if (isDataProcessingStep) {
		extraProps.editMode = store.editMode
		extraProps.editDocumentCode = store.editDocumentCode
		extraProps.knowledgeCode = store.knowledgeCode || undefined
	}

	if (isWikiOrProjectSelectionStep) {
		extraProps.editDocumentCode = store.editDocumentCode
	}

	// 编辑模式下，第一个显示的步骤不应该有"上一步"按钮
	if (store.editMode && currentStep === 1) {
		extraProps.showPrevious = false
	}

	return (
		<Suspense fallback={<StepLoadingSkeleton />}>
			<StepComponent
				store={stepStore}
				onNext={onNext}
				onPrevious={onPrevious}
				{...extraProps}
			/>
		</Suspense>
	)
})
