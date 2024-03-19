import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProjectListItem, Workspace } from "../pages/Workspace/types"
import { isCollaborationWorkspace } from "../constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface UseProjectEditingParams {
	selectedWorkspace: Workspace | null
	projects: ProjectListItem[]
	onSave: (projectId: string, projectName: string) => Promise<void>
}

export function useProjectEditing({
	selectedWorkspace,
	projects,
	onSave,
}: UseProjectEditingParams) {
	const { t } = useTranslation("super")

	const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
	const [editingProjectName, setEditingProjectName] = useState("")
	const isSavingRef = useRef(false)

	// Reset editing state
	const resetProjectEditing = useCallback(() => {
		setEditingProjectId(null)
		setEditingProjectName("")
	}, [])

	// Handle project name input change
	const handleProjectInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setEditingProjectName(e.target.value)
	}, [])

	// Save edited content
	const handleProjectEdit = useCallback(async () => {
		if (
			isSavingRef.current ||
			!selectedWorkspace ||
			isCollaborationWorkspace(selectedWorkspace)
		)
			return

		const trimmedName = (editingProjectName || "").trim()
		if (trimmedName === "") return

		if (
			trimmedName ===
			projects.find((project) => project.id === editingProjectId)?.project_name
		) {
			resetProjectEditing()
			return
		}

		// Set saving flag immediately
		isSavingRef.current = true

		try {
			if (editingProjectId) {
				await onSave(editingProjectId, trimmedName)
				magicToast.success(t("project.renameProjectSuccess"))
			}
		} catch (error) {
			console.log("重命名项目失败，失败原因：", error)
		} finally {
			isSavingRef.current = false
		}

		resetProjectEditing()
	}, [
		selectedWorkspace,
		editingProjectName,
		projects,
		resetProjectEditing,
		editingProjectId,
		onSave,
		t,
	])

	// Handle input keyboard events
	const handleProjectInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (isSavingRef.current) return

			if (e.key === "Enter") {
				e.preventDefault()
				e.stopPropagation()
				handleProjectEdit()
			} else if (e.key === "Escape") {
				e.preventDefault()
				resetProjectEditing()
			}
		},
		[handleProjectEdit, resetProjectEditing],
	)

	// Handle input blur event
	const handleProjectInputBlur = useCallback(() => {
		if (isSavingRef.current) return

		const trimmedName = (editingProjectName || "").trim()
		if (trimmedName !== "") {
			handleProjectEdit()
		} else {
			resetProjectEditing()
		}
	}, [editingProjectName, handleProjectEdit, resetProjectEditing])

	// Start editing project
	const handleStartEditProject = useCallback((project: ProjectListItem, e: React.MouseEvent) => {
		e.stopPropagation()
		setEditingProjectId(project.id)
		setEditingProjectName(project.project_name || "")
	}, [])

	// Set editing state (used by fetchProjects when isEditLast is true, or after creating project)
	const setEditingState = useCallback((projectId: string | null, projectName: string) => {
		setEditingProjectId(projectId)
		setEditingProjectName(projectName)
	}, [])

	return {
		editingProjectId,
		editingProjectName,
		handleProjectInputChange,
		handleProjectInputKeyDown,
		handleProjectInputBlur,
		handleStartEditProject,
		resetProjectEditing,
		setEditingState,
	}
}
