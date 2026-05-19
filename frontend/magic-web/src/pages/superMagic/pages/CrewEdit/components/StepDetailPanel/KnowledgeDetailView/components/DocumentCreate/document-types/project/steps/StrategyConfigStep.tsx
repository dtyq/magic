import { observer } from "mobx-react-lite"
import { StrategyConfigStep as LocalStrategyConfigStep } from "../../local/steps/StrategyConfigStep"
import type { LocalDocumentStore, ProjectDocumentStore } from "../../../store"

/**
 * StrategyConfigStep组件Props
 */
export interface StrategyConfigStepProps {
	store: ProjectDocumentStore
	onNext: () => void
	onPrevious: () => void
	/** 由 StepRenderer 在编辑模式第一步传入 false，隐藏「上一步」 */
	showPrevious?: boolean
}

/**
 * Project第2步：策略配置
 * 复用local-documents的策略配置组件
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2291029
 */
export const StrategyConfigStep = observer(function StrategyConfigStep({
	store,
	onNext,
	onPrevious,
	showPrevious = true,
}: StrategyConfigStepProps) {
	return (
		<LocalStrategyConfigStep
			store={store as unknown as LocalDocumentStore}
			onNext={onNext}
			onPrevious={onPrevious}
			showPrevious={showPrevious}
		/>
	)
})
