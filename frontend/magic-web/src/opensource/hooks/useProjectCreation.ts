import { useRef, useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { InputRef } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	TopicMode,
	ProjectListItem,
	Workspace,
	CreatedProject,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"

interface UseProjectCreationOptions {
	/** Selected workspace for creating project */
	selectedWorkspace?: Workspace | null
	/** Callback when project is created successfully */
	onProjectCreated?: (project: ProjectListItem) => void
	/** Callback to refresh projects list */
	onProjectsRefresh?: () => void
	/** Auto select the created project */
	autoSelect?: boolean
	/** Auto edit the created project after creation */
	autoEdit?: boolean
}

interface UseProjectCreationReturn {
	// States
	isCreatingProject: boolean
	isCreatingProjectLoading: boolean
	newProjectName: string
	projectInputRef: React.RefObject<InputRef>

	// Actions
	setNewProjectName: React.Dispatch<React.SetStateAction<string>>
	handleStartCreation: (options?: { projectMode?: TopicMode | ""; workdir?: string }) => void
	handleCreateProjectBlur: () => Promise<void>
	handleCreateProjectKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
	createProject: (options?: {
		projectMode?: TopicMode | ""
		workdir?: string
		projectName?: string
		projectDescription?: string
	}) => Promise<CreatedProject | null>
}

/**
 * Hook for managing project creation logic
 */
export function useProjectCreation({
	selectedWorkspace,
	onProjectCreated,
	onProjectsRefresh,
	autoSelect = true,
	autoEdit = false,
}: UseProjectCreationOptions = {}): UseProjectCreationReturn {
	const { t } = useTranslation("super")

	// States
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [isCreatingProjectLoading, setIsCreatingProjectLoading] = useState(false)
	const [newProjectName, setNewProjectName] = useState("")
	const projectInputRef = useRef<InputRef>(null)

	/** Create project API call */
	const createProjectInternal = useMemoizedFn(
		async (
			options: {
				projectMode?: TopicMode | ""
				workdir?: string
				projectName?: string
				projectDescription?: string
			} = {},
		): Promise<CreatedProject | null> => {
			if (!selectedWorkspace) {
				console.warn("No selected workspace for creating project")
				return null
			}

			const { projectMode = "", workdir, projectName = "", projectDescription = "" } = options

			try {
				setIsCreatingProjectLoading(true)
				const res = await SuperMagicApi.createProject({
					workspace_id: selectedWorkspace.id,
					project_name: projectName,
					project_description: projectDescription,
					project_mode: projectMode,
					workdir,
				})

				if (res?.project) {
					magicToast.success(t("project.createProjectSuccess"))

					// Refresh projects list
					onProjectsRefresh?.()

					// Auto select created project
					if (autoSelect) {
						onProjectCreated?.(res.project)
					}

					return res
				}
			} catch (error) {
				console.error("Failed to create project:", error)
				magicToast.error(t("project.createProjectFailed") || "创建项目失败")
			} finally {
				setIsCreatingProjectLoading(false)
			}

			return null
		},
	)

	/** Start creating project with inline input */
	const handleStartCreation = useMemoizedFn(() => {
		setIsCreatingProject(true)
		// Focus input after render
		setTimeout(() => {
			projectInputRef.current?.focus()
		}, 100)
	})

	/** Handle project creation on input blur */
	const handleCreateProjectBlur = useMemoizedFn(async () => {
		if (isCreatingProjectLoading) return

		try {
			const trimmedName = newProjectName.trim()
			if (trimmedName) {
				const res = await createProjectInternal({
					projectName: trimmedName,
				})

				if (res?.project && autoEdit) {
					// Handle auto edit if needed - this would be implemented by parent component
					// since editing logic varies by component
				}
			}

			// Reset creation state
			setIsCreatingProject(false)
			setNewProjectName("")
		} catch (error) {
			console.error("Failed to create project on blur:", error)
		}
	})

	/** Handle keyboard events for project creation */
	const handleCreateProjectKeyDown = useMemoizedFn((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleCreateProjectBlur()
		} else if (e.key === "Escape") {
			// Cancel creation
			setIsCreatingProject(false)
			setNewProjectName("")
			e.stopPropagation()
		}
	})

	return {
		// States
		isCreatingProject,
		isCreatingProjectLoading,
		newProjectName,
		projectInputRef,

		// Actions
		setNewProjectName,
		handleStartCreation,
		handleCreateProjectBlur,
		handleCreateProjectKeyDown,
		createProject: createProjectInternal,
	}
}
