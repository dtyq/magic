import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { DocumentCreateLayout } from "./layout"
import { DOCUMENT_TYPE_I18N_KEYS } from "./constants"
import { StepRenderer } from "./components/StepRenderer"
import { ErrorView } from "./components/ErrorView"
import {
	useDocumentCreateStore,
	useDocumentCreateNavigation,
	useDocumentCreateSteps,
} from "./hooks"
import type { DocumentCreateProps } from "./types"

/**
 * 文档创建主组件
 *
 * 重构后的版本使用配置驱动和策略模式：
 * - 使用 StepRenderer 统一渲染步骤组件，消除重复代码
 * - 通过 STEP_COMPONENT_REGISTRY 动态加载步骤组件
 * - 提取 hooks 管理状态、导航和步骤计算
 * - 遵循单一职责原则，提高可维护性和可扩展性
 *
 * @see hooks/useDocumentCreateStore.ts
 * @see hooks/useDocumentCreateNavigation.ts
 * @see hooks/useDocumentCreateSteps.ts
 * @see config/step-registry.ts
 */
export const DocumentCreate = observer(function DocumentCreate({
	knowledgeCode,
	documentType,
	knowledgeName,
	editMode = false,
	editDocumentCode = null,
	onComplete,
	onCancel,
}: DocumentCreateProps) {
	const { t } = useTranslation("crew/create")

	// 初始化 store
	const store = useDocumentCreateStore(knowledgeCode, documentType, editMode, editDocumentCode)

	// 导航回调
	const { handleNext, handlePrevious, handleBack, handleClose, handleComplete } =
		useDocumentCreateNavigation({
			store,
			onComplete,
			onCancel,
		})

	// 步骤数据
	const { steps } = useDocumentCreateSteps({ store })

	// 早期返回：无效的文档类型
	if (!store.documentType) {
		return (
			<ErrorView
				message={t("documentCreate.error.invalidType")}
				description={t("documentCreate.error.selectValidType")}
			/>
		)
	}

	return (
		<DocumentCreateLayout
			knowledgeName={knowledgeName || t("documentCreate.common.knowledgeBase")}
			documentTypeName={t(DOCUMENT_TYPE_I18N_KEYS[store.documentType])}
			currentStep={store.currentStep}
			steps={steps}
			onBack={handleBack}
			onClose={handleClose}
		>
			<StepRenderer
				documentType={store.documentType}
				currentStep={store.currentStep}
				store={store}
				onNext={handleNext}
				onPrevious={handlePrevious}
			/>
		</DocumentCreateLayout>
	)
})
export type { DocumentCreateProps }

export default DocumentCreate
