import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { type FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseWorkspaceCreationOptions {
	/** Fetch workspaces function */
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
	/** Callback when workspace is created successfully */
	onWorkspaceCreated?: (workspaceId: string) => void
}

interface UseWorkspaceCreationReturn {
	// States
	isCreatingWorkspace: boolean
	isCreatingWorkspaceLoading: boolean
	newWorkspaceName: string
	workspaceInputRef: React.RefObject<HTMLInputElement | null>

	// Actions
	setNewWorkspaceName: React.Dispatch<React.SetStateAction<string>>
	handleStartCreation: () => void
	handleCancelCreation: () => void
	handleCreateWorkspaceBlur: () => Promise<void>
	handleCreateWorkspaceKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Hook for managing workspace creation logic
 */
export function useWorkspaceCreation({
	fetchWorkspaces,
	onWorkspaceCreated,
}: UseWorkspaceCreationOptions): UseWorkspaceCreationReturn {
	const { t } = useTranslation("super")

	// States
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [isCreatingWorkspaceLoading, setIsCreatingWorkspaceLoading] = useState(false)
	const [newWorkspaceName, setNewWorkspaceName] = useState("")
	const workspaceInputRef = useRef<HTMLInputElement | null>(null)

	/** Start creating workspace */
	const handleStartCreation = useMemoizedFn(() => {
		setIsCreatingWorkspace(true)
		// Focus input after render
		setTimeout(() => {
			workspaceInputRef.current?.focus()
		}, 100)
	})

	/** Handle workspace creation on input blur */
	const handleCreateWorkspaceBlur = useMemoizedFn(async () => {
		if (isCreatingWorkspaceLoading) return

		try {
			const trimmedName = newWorkspaceName.trim()
			if (trimmedName) {
				setIsCreatingWorkspaceLoading(true)
				const res = await SuperMagicApi.createWorkspace({
					workspace_name: trimmedName,
				})

				if (res?.id) {
					// Refresh workspace list
					fetchWorkspaces({
						isAutoSelect: false,
						isSelectLast: false,
						isEditLast: false,
						page: 1,
					})

					magicToast.success(t("hierarchicalWorkspacePopup.createSuccess"))

					// Notify parent component about the created workspace
					onWorkspaceCreated?.(res.id)
				}
			}

			// Reset creation state
			setIsCreatingWorkspace(false)
			setNewWorkspaceName("")
		} catch (error) {
			console.error("Failed to create workspace:", error)
		} finally {
			setIsCreatingWorkspaceLoading(false)
		}
	})

	/** Cancel workspace creation */
	const handleCancelCreation = useMemoizedFn(() => {
		setIsCreatingWorkspace(false)
		setNewWorkspaceName("")
	})

	/** Handle keyboard events for workspace creation */
	const handleCreateWorkspaceKeyDown = useMemoizedFn(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				handleCreateWorkspaceBlur()
			} else if (e.key === "Escape") {
				e.stopPropagation()
				handleCancelCreation()
			}
		},
	)

	return {
		// States
		isCreatingWorkspace,
		isCreatingWorkspaceLoading,
		newWorkspaceName,
		workspaceInputRef,

		// Actions
		setNewWorkspaceName,
		handleStartCreation,
		handleCancelCreation,
		handleCreateWorkspaceBlur,
		handleCreateWorkspaceKeyDown,
	}
}
