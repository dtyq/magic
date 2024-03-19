import { useEffect } from "react"

/**
 * Hook for registering save handler when component enters edit mode
 *
 * @param isEditMode - Whether the component is in edit mode
 * @param handleSave - The save function to register
 * @param onRegisterSaveHandler - The registration callback from parent
 */
function useSaveHandlerRegistration({
	isEditMode,
	handleSave,
	onRegisterSaveHandler,
}: {
	isEditMode?: boolean
	handleSave: () => Promise<void>
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
}) {
	useEffect(() => {
		if (!onRegisterSaveHandler) return

		if (isEditMode) {
			// Register save handler when entering edit mode
			onRegisterSaveHandler(handleSave)
		} else {
			// Unregister when leaving edit mode
			onRegisterSaveHandler(null)
		}

		// Cleanup on unmount
		return () => {
			onRegisterSaveHandler(null)
		}
	}, [isEditMode, onRegisterSaveHandler, handleSave])
}

export default useSaveHandlerRegistration
