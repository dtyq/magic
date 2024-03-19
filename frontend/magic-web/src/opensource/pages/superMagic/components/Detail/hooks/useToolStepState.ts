import { useMemo } from "react"

interface UseToolStepStateProps {
	toolSteps: any[]
	currentStepIndex: number
}

interface UseToolStepStateReturn {
	currentToolStep: any | null
}

function useToolStepState({
	toolSteps,
	currentStepIndex,
}: UseToolStepStateProps): UseToolStepStateReturn {
	// 获取当前工具步骤
	const currentToolStep = useMemo(() => {
		if (toolSteps.length > 0 && currentStepIndex < toolSteps.length) {
			return toolSteps[currentStepIndex]
		}
		return null
	}, [toolSteps, currentStepIndex])

	return {
		currentToolStep,
	}
}

export default useToolStepState
export type { UseToolStepStateProps, UseToolStepStateReturn }
