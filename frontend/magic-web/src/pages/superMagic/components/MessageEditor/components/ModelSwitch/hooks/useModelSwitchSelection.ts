import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { isModelDisabled } from "../utils"
import type { ModelItem } from "../types"

interface UseModelSwitchSelectionProps {
	onModelClick: (model: ModelItem) => void
	onModelSelected?: () => void
}

export function useModelSwitchSelection({
	onModelClick,
	onModelSelected,
}: UseModelSwitchSelectionProps) {
	const [isOpeningModal, setIsOpeningModal] = useState(false)

	const handleModelClick = useMemoizedFn((model: ModelItem) => {
		if (isModelDisabled(model)) {
			return
		}

		onModelClick(model)
		onModelSelected?.()
	})

	const resetIsOpeningModal = useMemoizedFn(() => {
		setIsOpeningModal(false)
	})

	return {
		isOpeningModal,
		handleModelClick,
		resetIsOpeningModal,
	}
}
