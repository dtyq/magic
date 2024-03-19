import { useCallback, useRef, useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import type { Workspace } from "../pages/Workspace/types"

export interface UseWorkspaceEditingParams {
	selectedWorkspace: Workspace | null
	workspaces: Workspace[]
	onSave: (workspaceId: string, workspaceName: string) => Promise<void>
	onSaveSuccess?: () => void
}

export function useWorkspaceEditing({
	selectedWorkspace,
	workspaces,
	onSave,
	onSaveSuccess,
}: UseWorkspaceEditingParams) {
	const { t } = useTranslation("super")

	const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
	const [editingWorkspaceName, setEditingWorkspaceName] = useState("")
	const isSavingRef = useRef(false)

	// Reset editing state
	const resetWorkspaceEditing = useCallback(() => {
		setEditingWorkspaceId(null)
		setEditingWorkspaceName("")
	}, [])

	// Handle workspace name input change
	const handleWorkspaceInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setEditingWorkspaceName(e.target.value)
	}, [])

	// Save edited content
	const handleWorkspaceEdit = useCallback(async () => {
		if (isSavingRef.current || !selectedWorkspace) return

		const trimmedName = (editingWorkspaceName || "").trim()
		if (trimmedName === "") return

		if (trimmedName === workspaces.find((ws) => ws.id === editingWorkspaceId)?.name) {
			resetWorkspaceEditing()
			return
		}

		// Set saving flag immediately
		isSavingRef.current = true

		try {
			if (editingWorkspaceId) {
				await onSave(editingWorkspaceId, trimmedName)
				magicToast.success(t("workspace.renameWorkspaceSuccess"))
				onSaveSuccess?.()
			}
		} catch (error) {
			console.log(error, "err")
		} finally {
			isSavingRef.current = false
		}

		resetWorkspaceEditing()
	}, [
		selectedWorkspace,
		editingWorkspaceName,
		editingWorkspaceId,
		workspaces,
		onSave,
		onSaveSuccess,
		resetWorkspaceEditing,
		t,
	])

	// Handle input keyboard events
	const handleWorkspaceInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (isSavingRef.current) return

			if (e.key === "Enter") {
				e.preventDefault()
				e.stopPropagation()
				handleWorkspaceEdit()
			} else if (e.key === "Escape") {
				e.preventDefault()
				resetWorkspaceEditing()
			}
		},
		[handleWorkspaceEdit, resetWorkspaceEditing],
	)

	// Handle input blur event
	const handleWorkspaceInputBlur = useCallback(() => {
		if (isSavingRef.current) return

		const trimmedName = (editingWorkspaceName || "").trim()
		if (trimmedName !== "") {
			handleWorkspaceEdit()
		} else {
			resetWorkspaceEditing()
		}
	}, [editingWorkspaceName, handleWorkspaceEdit, resetWorkspaceEditing])

	// Start editing workspace
	const handleStartEditWorkspace = useCallback((workspace: Workspace, e: React.MouseEvent) => {
		e.stopPropagation()
		setEditingWorkspaceId(workspace.id)
		setEditingWorkspaceName(workspace.name || "")
	}, [])

	// Set editing state (used by fetchWorkspaces when isEditLast is true)
	const setEditingState = useCallback((workspaceId: string | null, workspaceName: string) => {
		setEditingWorkspaceId(workspaceId)
		setEditingWorkspaceName(workspaceName)
	}, [])

	return {
		editingWorkspaceId,
		editingWorkspaceName,
		handleWorkspaceInputChange,
		handleWorkspaceInputKeyDown,
		handleWorkspaceInputBlur,
		handleStartEditWorkspace,
		resetWorkspaceEditing,
		setEditingState,
	}
}
