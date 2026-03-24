import { useDebounceFn, useMemoizedFn } from "ahooks"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import {
	sendSuperMagicInterruptMessage,
	SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
} from "@/pages/superMagic/services/sendSuperMagicInterruptMessage"

interface UseTaskInterruptParams {
	selectedTopic: Topic | null
	userId: string | null | undefined
	isStopping: boolean
	setIsStopping: (loading: boolean) => void
	canInterrupt?: boolean
}

export function useTaskInterrupt({
	selectedTopic,
	userId,
	isStopping,
	setIsStopping,
	canInterrupt = true,
}: UseTaskInterruptParams) {
	const handleInterruptCore = useMemoizedFn(() => {
		if (isStopping || !canInterrupt) return

		setIsStopping(true)
		void sendSuperMagicInterruptMessage({
			selectedTopic,
			userId,
		}).finally(() => {
			setIsStopping(false)
		})
	})

	const { run: handleInterrupt } = useDebounceFn(handleInterruptCore, {
		wait: SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
		leading: true,
		trailing: false,
	})

	return {
		handleInterrupt,
	}
}
