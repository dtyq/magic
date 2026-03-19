import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { validateFilename } from "@/utils/filename-validator"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseCreateProjectOptions {
	workspaceId: string
	projects: ProjectListItem[]
	onProjectCreated?: (project: ProjectListItem) => Promise<void>
	onProjectsRefresh?: () => Promise<void>
}

export function useCreateProject(options: UseCreateProjectOptions) {
	const { t } = useTranslation("super")
	const { workspaceId, projects, onProjectCreated, onProjectsRefresh } = options

	const [createProjectShown, setCreateProjectShown] = useState(false)
	const [createProjectName, setCreateProjectName] = useState("")
	const [createProjectErrorMessage, setCreateProjectErrorMessage] = useState("")
	const [loading, setLoading] = useState(false)

	const showCreateProject = useMemoizedFn(() => {
		if (createProjectShown) {
			magicToast.info(t("selectPathModal.completeFolderCreation"))
			return
		}
		setCreateProjectShown(true)
		setCreateProjectName(t("selectPathModal.defaultProjectName"))
		setCreateProjectErrorMessage("")
	})

	const cancelCreateProject = useMemoizedFn(() => {
		setCreateProjectShown(false)
		setCreateProjectErrorMessage("")
		setCreateProjectName("")
	})

	const submitCreateProject = useMemoizedFn(async () => {
		const normalizedName = createProjectName.trim()
		if (!normalizedName) {
			setCreateProjectErrorMessage(t("selectPathModal.enterSubfolderName"))
			return
		}

		// 文件名验证
		const validation = validateFilename(normalizedName, true, { t })
		if (!validation.isValid) {
			setCreateProjectErrorMessage(validation.errorMessage || "")
			return
		}

		// 重名校验（仅在当前项目列表）
		const isDuplicate = projects.some(
			(project) => project.project_name?.trim() === normalizedName,
		)
		if (isDuplicate) {
			setCreateProjectErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			return
		}

		setLoading(true)

		try {
			const response = await SuperMagicApi.createProject({
				workspace_id: workspaceId,
				project_name: normalizedName,
				project_description: "",
				project_mode: "",
			})

			if (response?.project) {
				magicToast.success(t("selectPathModal.createdSuccessfully"))

				// 刷新项目列表
				if (onProjectsRefresh) {
					await onProjectsRefresh()
				}

				// 重置创建状态
				setCreateProjectErrorMessage("")
				setCreateProjectShown(false)
				setCreateProjectName("")

				// 自动选中新创建的项目
				if (onProjectCreated && response.project) {
					await onProjectCreated(response.project)
				}
			}
		} catch (error) {
			console.error("Failed to create project:", error)
			setCreateProjectErrorMessage("创建项目失败")
		}

		setLoading(false)
	})

	const onCreateProjectInputKeyDown = useMemoizedFn(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			e.stopPropagation()
			if (e.key === "Escape") {
				e.stopPropagation()
				cancelCreateProject()
			}
		},
	)

	const onCreateProjectInputChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setCreateProjectName(e.target.value || "")
		setCreateProjectErrorMessage("")
	})

	const onCreateProjectInputFocus = useMemoizedFn((e: React.FocusEvent<HTMLInputElement>) => {
		// 全选默认文本，方便用户直接输入新名称
		e.target.select()
	})

	return {
		createProjectShown,
		createProjectName,
		createProjectErrorMessage,
		showCreateProject,
		cancelCreateProject,
		submitCreateProject,
		onCreateProjectInputKeyDown,
		onCreateProjectInputChange,
		onCreateProjectInputFocus,
		loading,
	}
}
