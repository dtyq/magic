import { useMemo } from "react"
import type { DocumentCreateStore } from "../store"
import type { Step } from "../components/StepIndicator/types"

interface UseDocumentCreateStepsParams {
	store: DocumentCreateStore
}

interface UseDocumentCreateStepsReturn {
	steps: Step[]
	currentStepIndex: number
}

/**
 * Hook: 管理步骤相关状态
 *
 * 从 store 获取步骤配置并计算当前步骤索引和状态
 *
 * @param store - DocumentCreateStore 实例
 * @returns 步骤数组和当前步骤索引
 */
export function useDocumentCreateSteps({
	store,
}: UseDocumentCreateStepsParams): UseDocumentCreateStepsReturn {
	const steps = useMemo<Step[]>(() => {
		const configs = store.getAllStepConfigs()

		return configs.map((config) => ({
			number: config.number,
			i18nKey: config.i18nKey,
			status:
				config.number < store.currentStep
					? "completed"
					: config.number === store.currentStep
						? "current"
						: "pending",
		}))
	}, [store, store.currentStep, store.documentType])

	const currentStepIndex = useMemo(() => store.currentStep - 1, [store.currentStep])

	return {
		steps,
		currentStepIndex,
	}
}
