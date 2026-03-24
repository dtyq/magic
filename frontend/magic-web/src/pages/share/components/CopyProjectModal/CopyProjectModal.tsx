import { useState, useEffect, useMemo } from "react"
import { Modal, Input, Button } from "antd"
import { IconPlus, IconFolder, IconSearch, IconCheck } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { CopyProjectModalProps, WorkspaceOption } from "./types"
import { SuperMagicApi } from "@/apis"
import folderIcon from "@/pages/share/components/CopyProjectModal/assets/folder.svg"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/utils"
import { WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"

function CopyProjectModal({ open, onCancel, projectData, onCopySuccess }: CopyProjectModalProps) {
	const { t } = useTranslation("super")

	// 状态管理
	const [newProjectName, setNewProjectName] = useState("")
	const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
	const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceOption | null>(null)
	const [searchValue, setSearchValue] = useState("")
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [newWorkspaceName, setNewWorkspaceName] = useState("")
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)

	// 初始化项目名称
	useEffect(() => {
		if (open && projectData?.defaultNewProjectName) {
			setNewProjectName(projectData.defaultNewProjectName)
		}
	}, [open, projectData?.defaultNewProjectName])

	// 获取工作区列表
	const fetchWorkspaces = useMemoizedFn(async () => {
		if (!open) return

		setLoading(true)
		try {
			const response = await SuperMagicApi.getWorkspaces({ page: 1, page_size: 99 })
			if (response?.list) {
				setWorkspaces(response.list)
				// 默认选择第一个工作区
				if (response.list.length > 0 && !selectedWorkspace) {
					setSelectedWorkspace(response.list[0])
				}
			}
		} catch (error) {
			console.error("获取工作区列表失败:", error)
			magicToast.error(t("workspace.fetchWorkspacesFailed"))
		} finally {
			setLoading(false)
		}
	})

	useEffect(() => {
		fetchWorkspaces()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	// 过滤工作区列表
	const filteredWorkspaces = useMemo(() => {
		if (!searchValue.trim()) return workspaces
		return workspaces.filter((workspace) =>
			workspace.name.toLowerCase().includes(searchValue.toLowerCase()),
		)
	}, [workspaces, searchValue])

	// 处理工作区选择
	const handleWorkspaceSelect = useMemoizedFn((workspace: WorkspaceOption) => {
		setSelectedWorkspace(workspace)
		setIsCreatingWorkspace(false)
		setNewWorkspaceName("")
	})

	// 处理新建工作区
	const handleCreateNewWorkspace = useMemoizedFn(() => {
		setIsCreatingWorkspace(true)
		setSelectedWorkspace(null)
	})

	// 保存新建工作区
	const handleSaveNewWorkspace = useMemoizedFn(async () => {
		if (!newWorkspaceName.trim()) return

		try {
			const response = await SuperMagicApi.createWorkspace({
				workspace_name: newWorkspaceName.trim(),
			})
			if (response?.id) {
				const newWorkspace: WorkspaceOption = {
					id: response.id,
					name: newWorkspaceName.trim(),
					is_archived: 0,
					current_topic_id: "",
					current_project_id: null,
					workspace_status: WorkspaceStatus.WAITING,
					project_count: 0,
				}

				setWorkspaces((prev) => [newWorkspace, ...prev])
				setSelectedWorkspace(newWorkspace)
				setIsCreatingWorkspace(false)
				setNewWorkspaceName("")
				magicToast.success(t("workspace.createWorkspaceSuccess"))
			}
		} catch (error) {
			console.error("创建工作区失败:", error)
			magicToast.error(t("workspace.createWorkspaceFailed"))
		}
	})

	// 处理输入框失焦
	const handleWorkspaceInputBlur = useMemoizedFn(() => {
		if (newWorkspaceName.trim()) {
			handleSaveNewWorkspace()
		} else {
			setIsCreatingWorkspace(false)
		}
	})

	// 处理回车键
	const handleWorkspaceInputKeyDown = useMemoizedFn((e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			handleSaveNewWorkspace()
		} else if (e.key === "Escape") {
			setIsCreatingWorkspace(false)
			setNewWorkspaceName("")
		}
	})

	// 提交复制项目
	const handleSubmit = useMemoizedFn(async () => {
		if (!selectedWorkspace || !newProjectName.trim()) {
			return
		}

		// 统一使用新接口，resourceId 优先，否则使用 projectId（旧分享）
		const resourceIdToUse = projectData?.resourceId || projectData?.projectId

		if (!resourceIdToUse) {
			return
		}

		setSubmitting(true)
		try {
			// 统一使用新接口：复制分享资源
			const response = await SuperMagicApi.copyShareResource({
				resource_id: resourceIdToUse,
				target_workspace_id: selectedWorkspace.id,
				password: projectData.password,
			})

			if (response) {
				// 适配新接口返回的数据结构
				const adaptedResponse = {
					project_id: String(response.new_project_id),
					project_name: newProjectName.trim(),
					workspace_id: selectedWorkspace.id,
					workspace_name: selectedWorkspace.name,
				}
				// magicToast.success(t("share.copyProjectSuccess"))
				onCopySuccess?.(adaptedResponse, selectedWorkspace.id)
				handleClose()
			}
		} catch (error) {
			console.error("复制项目失败:", error)
			magicToast.error(t("share.copyProjectFailed"))
		} finally {
			setSubmitting(false)
		}
	})

	// 关闭弹窗
	const handleClose = useMemoizedFn(() => {
		setNewProjectName("")
		setSearchValue("")
		setIsCreatingWorkspace(false)
		setNewWorkspaceName("")
		setSelectedWorkspace(null)
		onCancel()
	})

	// 表单验证
	const isFormValid = useMemo(() => {
		return newProjectName.trim() && selectedWorkspace && !isCreatingWorkspace
	}, [newProjectName, selectedWorkspace, isCreatingWorkspace])

	return (
		<Modal
			open={open}
			onCancel={handleClose}
			footer={null}
			width={700}
			centered
			title={null}
			closable={false}
		>
			<div>
				{/* 标题和描述 */}
				<div className="mb-5 h-10">
					<div className="text-base font-semibold leading-[22px]">
						{t("share.copyProject")}
					</div>
					<div className="mb-2.5 text-xs leading-4 text-muted-foreground">
						{t("share.copyProjectDescription")}
					</div>
				</div>

				{/* 原项目信息 */}
				<div className="flex flex-row gap-2.5">
					<div className="flex flex-col gap-2">
						<span className="text-sm font-normal leading-5 text-foreground">
							{`${t("share.originalProject")}${t("share.author")}`}
						</span>
						<div className="flex h-9 items-center justify-start gap-1.5 rounded-lg border border-border bg-muted px-1.5 text-sm font-semibold leading-5 text-foreground">
							{projectData?.originalAuthor}
						</div>
					</div>

					<div className="flex flex-1 flex-col gap-2">
						<span className="text-sm font-normal leading-5 text-foreground">
							{`${t("share.originalProject")}${t("share.name")}`}
						</span>
						<div className="flex h-9 items-center justify-start gap-1.5 rounded-lg border border-border bg-muted px-1.5 text-sm font-semibold leading-5 text-foreground">
							{projectData?.originalProjectName || t("project.unnamedProject")}
						</div>
					</div>
				</div>

				{/* 新项目名称 */}
				<div className="mt-5 rounded-xl border border-border p-5">
					<div className="mb-4">
						<div className="mb-1 block text-sm font-medium text-foreground">
							{t("share.newProjectName")}
						</div>
						<div className="mb-2.5 text-xs leading-4 text-muted-foreground">
							{t("share.newProjectDescription")}
						</div>
						<Input
							prefix={
								<IconFolder
									size={16}
									stroke={1.5}
									className="text-muted-foreground"
								/>
							}
							value={newProjectName}
							onChange={(e) => setNewProjectName(e.target.value)}
							placeholder={t("share.enterNewProjectName")}
							className="w-full"
						/>
					</div>
					<div className="mb-2 text-sm font-medium text-foreground">
						{t("share.selectWorkspace")}
					</div>
					<div className="mb-2.5 text-xs leading-4 text-muted-foreground">
						{t("share.newProjectWorkspaceDescription")}
					</div>
					{/* 工作区选择 */}

					<div className="mt-5 gap-5 rounded-xl border border-border">
						<div>
							{/* 搜索框 */}
							<div className="mb-2.5 rounded-t-lg bg-muted p-2.5">
								<Input
									prefix={<IconSearch size={16} />}
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									placeholder={t("share.searchWorkspace")}
									className="rounded-lg"
								/>
							</div>
							{/* 工作区列表 */}
							<div className="max-h-[200px] overflow-y-auto rounded-lg bg-background p-2.5">
								{/* 新建工作区选项 */}
								{!isCreatingWorkspace ? (
									<div
										className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-all hover:bg-accent"
										onClick={handleCreateNewWorkspace}
									>
										<div className="flex h-6 w-6 items-center justify-center rounded text-foreground">
											<IconPlus size={16} />
										</div>
										<span className="text-foreground">
											{t("share.createNewWorkspace")}
										</span>
									</div>
								) : (
									<div className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-1.5">
										<div className="flex h-6 w-6 items-center justify-center rounded text-foreground">
											<IconPlus size={16} />
										</div>
										<Input
											value={newWorkspaceName}
											onChange={(e) => setNewWorkspaceName(e.target.value)}
											onBlur={handleWorkspaceInputBlur}
											onKeyDown={handleWorkspaceInputKeyDown}
											placeholder={t("share.enterWorkspaceName")}
											autoFocus
										/>
									</div>
								)}
								{loading ? (
									<div className="p-6 text-center text-sm text-muted-foreground">
										{t("common.loading")}
									</div>
								) : filteredWorkspaces.length > 0 ? (
									filteredWorkspaces.map((workspace) => (
										<div
											key={workspace.id}
											className={cn(
												"flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 px-2.5 hover:bg-accent",
												selectedWorkspace?.id === workspace.id &&
													"border-primary bg-accent/50 hover:bg-accent",
											)}
											onClick={() => handleWorkspaceSelect(workspace)}
										>
											<div>
												<img src={folderIcon} alt="folder" />
											</div>
											<div className="flex-1">
												<div className="text-sm font-medium text-foreground">
													{workspace.name || t("share.unNamedWorkspace")}
												</div>
											</div>
											{selectedWorkspace?.id === workspace.id && (
												<IconCheck size={16} className="text-primary" />
											)}
										</div>
									))
								) : (
									<div className="p-6 text-center text-sm text-muted-foreground">
										{t("share.noWorkspaceFound")}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* 底部按钮 */}
				<div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
					<Button onClick={handleClose} className="min-w-[80px]">
						{t("common.cancel")}
					</Button>
					<Button
						type="primary"
						onClick={handleSubmit}
						loading={submitting}
						disabled={!isFormValid}
						className="min-w-[80px]"
					>
						{t("common.confirm")}
					</Button>
				</div>
			</div>
		</Modal>
	)
}

export default CopyProjectModal
