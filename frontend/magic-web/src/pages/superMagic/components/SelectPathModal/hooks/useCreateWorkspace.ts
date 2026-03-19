import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { validateFilename } from "@/utils/filename-validator"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseCreateWorkspaceOptions {
	workspaces: Workspace[]
	onWorkspaceCreated?: (workspace: Workspace) => Promise<void>
	onWorkspacesRefresh?: () => Promise<void>
}

export function useCreateWorkspace(options: UseCreateWorkspaceOptions) {
	const { t } = useTranslation("super")
	const { workspaces, onWorkspaceCreated, onWorkspacesRefresh } = options

	const [createWorkspaceShown, setCreateWorkspaceShown] = useState(false)
	const [createWorkspaceName, setCreateWorkspaceName] = useState("")
	const [createWorkspaceErrorMessage, setCreateWorkspaceErrorMessage] = useState("")
	const [loading, setLoading] = useState(false)

	const showCreateWorkspace = useMemoizedFn(() => {
		if (createWorkspaceShown) {
			magicToast.info(t("selectPathModal.completeFolderCreation"))
			return
		}
		setCreateWorkspaceShown(true)
		setCreateWorkspaceName(t("selectPathModal.defaultWorkspaceName"))
		setCreateWorkspaceErrorMessage("")
	})

	const cancelCreateWorkspace = useMemoizedFn(() => {
		setCreateWorkspaceShown(false)
		setCreateWorkspaceErrorMessage("")
		setCreateWorkspaceName("")
	})

	const submitCreateWorkspace = useMemoizedFn(async () => {
		const normalizedName = createWorkspaceName.trim()
		if (!normalizedName) {
			setCreateWorkspaceErrorMessage(t("selectPathModal.enterSubfolderName"))
			return
		}

		// 文件名验证
		const validation = validateFilename(normalizedName, true, { t })
		if (!validation.isValid) {
			setCreateWorkspaceErrorMessage(validation.errorMessage || "")
			return
		}

		// 重名校验（仅在当前工作区列表）
		const isDuplicate = workspaces.some(
			(workspace) => workspace.name?.trim() === normalizedName,
		)
		if (isDuplicate) {
			setCreateWorkspaceErrorMessage(t("topicFiles.contextMenu.newFolder.duplicateError"))
			return
		}

		setLoading(true)

		try {
			const response = await SuperMagicApi.createWorkspace({
				workspace_name: normalizedName,
			})

			if (response?.id) {
				magicToast.success(t("selectPathModal.createdSuccessfully"))

				// 刷新工作区列表
				if (onWorkspacesRefresh) {
					await onWorkspacesRefresh()
				}

				// 重置创建状态
				setCreateWorkspaceErrorMessage("")
				setCreateWorkspaceShown(false)
				setCreateWorkspaceName("")

				// 自动选中新创建的工作区
				if (onWorkspaceCreated && response) {
					await onWorkspaceCreated(response)
				}
			}
		} catch (error) {
			console.error("Failed to create workspace:", error)
			setCreateWorkspaceErrorMessage("创建工作区失败")
		}

		setLoading(false)
	})

	const onCreateWorkspaceInputKeyDown = useMemoizedFn(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			e.stopPropagation()
			if (e.key === "Escape") {
				e.stopPropagation()
				cancelCreateWorkspace()
			}
		},
	)

	const onCreateWorkspaceInputChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setCreateWorkspaceName(e.target.value || "")
		setCreateWorkspaceErrorMessage("")
	})

	const onCreateWorkspaceInputFocus = useMemoizedFn((e: React.FocusEvent<HTMLInputElement>) => {
		// 全选默认文本，方便用户直接输入新名称
		e.target.select()
	})

	return {
		createWorkspaceShown,
		createWorkspaceName,
		createWorkspaceErrorMessage,
		showCreateWorkspace,
		cancelCreateWorkspace,
		submitCreateWorkspace,
		onCreateWorkspaceInputKeyDown,
		onCreateWorkspaceInputChange,
		onCreateWorkspaceInputFocus,
		loading,
	}
}
