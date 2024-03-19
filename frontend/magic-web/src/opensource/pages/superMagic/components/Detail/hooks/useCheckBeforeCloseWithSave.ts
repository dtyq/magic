import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"

/**
 * Hook for managing checkBeforeClose with save handler registration
 *
 * @param checkBeforeClose - The checkBeforeClose function from useEditMode
 * @param fileId - The current file ID
 * @param onRegisterCheckBeforeClose - Callback to register the wrapped checkBeforeClose
 * @param onUnregisterCheckBeforeClose - Callback to unregister the checkBeforeClose
 * @returns registerSaveHandler function
 */
function useCheckBeforeCloseWithSave({
	checkBeforeClose,
	fileId,
	onRegisterCheckBeforeClose,
	onUnregisterCheckBeforeClose,
}: {
	checkBeforeClose: (onSave?: () => Promise<void>) => Promise<"close" | "save" | "cancel">
	fileId?: string
	onRegisterCheckBeforeClose?: (fileId: string, callback: () => Promise<boolean>) => void
	onUnregisterCheckBeforeClose?: (fileId: string) => void
}) {
	// Store the save function from content component
	const contentSaveHandlerRef = useRef<(() => Promise<void>) | null>(null)

	// Register save handler from content component
	const registerSaveHandler = useMemoizedFn((handler: (() => Promise<void>) | null) => {
		contentSaveHandlerRef.current = handler
	})

	// Create a wrapped checkBeforeClose that supports saving
	const wrappedCheckBeforeClose = useMemoizedFn(async (): Promise<boolean> => {
		const handleSave = async () => {
			// Call the registered save handler from content component
			if (contentSaveHandlerRef.current) {
				await contentSaveHandlerRef.current()
			}
		}

		// Only pass handleSave if there's a registered handler
		const result = await checkBeforeClose(
			contentSaveHandlerRef.current ? handleSave : undefined,
		)
		return result !== "cancel"
	})

	// Register wrapped checkBeforeClose to FilesViewer
	useEffect(() => {
		if (fileId && onRegisterCheckBeforeClose) {
			onRegisterCheckBeforeClose(fileId, wrappedCheckBeforeClose)
		}

		return () => {
			if (fileId && onUnregisterCheckBeforeClose) {
				onUnregisterCheckBeforeClose(fileId)
			}
		}
	}, [fileId, wrappedCheckBeforeClose, onRegisterCheckBeforeClose, onUnregisterCheckBeforeClose])

	// Clean up save handler on unmount
	useEffect(() => {
		return () => {
			contentSaveHandlerRef.current = null
		}
	}, [])

	return {
		registerSaveHandler,
	}
}

export default useCheckBeforeCloseWithSave
