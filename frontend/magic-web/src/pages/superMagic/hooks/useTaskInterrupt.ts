import { useDebounceFn, useMemoizedFn } from "ahooks"
import { useRef } from "react"
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
	// Sync guard: blocks double-fire before isStopping re-renders
	const interruptLockRef = useRef(false)

	const handleInterruptCore = useMemoizedFn(() => {
		if (isStopping || !canInterrupt) return
		if (interruptLockRef.current) return

		interruptLockRef.current = true
		setIsStopping(true)
		void sendSuperMagicInterruptMessage({
			selectedTopic,
			userId,
		}).finally(() => {
			setIsStopping(false)
			interruptLockRef.current = false
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
