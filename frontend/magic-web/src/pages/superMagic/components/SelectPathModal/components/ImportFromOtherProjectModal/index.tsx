import React, { useState, useMemo, useEffect, useRef } from "react"
import { Dropdown, Menu } from "antd"
import { useMemoizedFn } from "ahooks"
import {
	IconChevronRight,
	IconDots,
	IconSearch,
	IconX,
	IconFolder,
	IconFileSearch,
} from "@tabler/icons-react"
import { isEmpty } from "lodash-es"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import BaseModal from "../BaseModal"
import MagicSpin from "@/components/base/MagicSpin"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import EmptyFilesIcon from "@/pages/superMagic/assets/svg/empty-files.svg"
import IconWorkspace from "../../../icons/IconWorkspace"
import IconProject from "../../../icons/IconProject"

import type { ImportFromOtherProjectModalProps, ViewMode } from "../../types"
import { SHARE_WORKSPACE_DATA, MY_CLAW_WORKSPACE_DATA } from "../../../../constants"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { getItemName } from "../../utils/attachmentUtils"

import {
	useWorkspaceManagement,
	useProjectManagement,
	useFileSelection,
	useDirectoryNavigation,
	useSearch,
	useBreadcrumb,
} from "./hooks"

function EmptyStateBox({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
			<div className="flex h-[320px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-card p-6">
				{children}
			</div>
		</div>
	)
}

function ImportFromOtherProjectModal({
	visible,
	workspaces,
	onClose,
	onSubmit,
}: ImportFromOtherProjectModalProps) {
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")

	const [viewMode, setViewMode] = useState<ViewMode>("workspace")
	const initializedRef = useRef(false)

	// 工作空间管理
	const workspaceManager = useWorkspaceManagement({ workspaces, t })

	// 项目管理
	const projectManager = useProjectManagement({ t })

	// 目录导航
	const directoryNav = useDirectoryNavigation({
		onEnterDirectory: () => {
			searchManager.clearSearch()
		},
	})

	// 文件选择
	const fileSelection = useFileSelection()

	// 搜索功能
	const searchManager = useSearch({
		viewMode,
		attachments: directoryNav.attachments,
		path: directoryNav.path,
		filesSort: directoryNav.filesSort,
		setDirectories: directoryNav.setDirectories,
		setLoading: directoryNav.setLoading,
		fetchDirectories: directoryNav.fetchDirectories,
	})

	// 面包屑导航
	const breadcrumb = useBreadcrumb({
		viewMode,
		currentWorkspace: workspaceManager.currentWorkspace,
		currentSourceProject: projectManager.currentSourceProject,
		path: directoryNav.path,
		visible,
		onWorkspaceClick: () => handleBackToWorkspace(),
		onProjectClick: () => handleBackToProject(),
		onDirectoryClick: (item) => {
			if (projectManager.currentSourceProject && viewMode === "directory") {
				const index = directoryNav.path.findIndex((o) => o.file_id === item.id)
				const newPath = index >= 0 ? directoryNav.path.slice(0, index + 1) : []
				directoryNav.navigateToPath(newPath, projectManager.currentSourceProject.id)
			}
		},
	})

	// 工作区选择处理
	const handleWorkspaceClick = useMemoizedFn(async (workspace) => {
		workspaceManager.selectWorkspace(workspace)
		setViewMode("project")
		projectManager.clearProject()
		directoryNav.clearNavigation()
		searchManager.clearSearch()
		await projectManager.fetchProjectsByWorkspace(workspace.id)
	})

	// 返回工作区列表
	const handleBackToWorkspace = useMemoizedFn(() => {
		setViewMode("workspace")
		workspaceManager.clearWorkspace()
		projectManager.clearProject()
		directoryNav.clearNavigation()
		searchManager.clearSearch()
		workspaceManager.refreshWorkspaces()
	})

	// 项目选择处理
	const handleProjectClick = useMemoizedFn(async (project) => {
		searchManager.clearSearch()
		projectManager.selectProject(project)
		setViewMode("directory")
		await directoryNav.loadProjectAttachments(project.id)
	})

	// 返回项目列表
	const handleBackToProject = useMemoizedFn(async () => {
		setViewMode("project")
		projectManager.clearProject()
		directoryNav.clearNavigation()
		searchManager.clearSearch()
		if (workspaceManager.currentWorkspace) {
			await projectManager.fetchProjectsByWorkspace(workspaceManager.currentWorkspace.id)
		}
	})

	const submit = useMemoizedFn(() => {
		const filesByProject = fileSelection.getSelectedFilesByProject()
		if (filesByProject.length === 0) return

		onSubmit && onSubmit({ filesByProject })
		onClose && onClose()
	})

	const canSubmit = useMemo(() => {
		return fileSelection.getSelectedFilesCount() > 0
	}, [fileSelection])

	const handleCancel = () => {
		onClose && onClose()
	}

	useEffect(() => {
		if (!visible) {
			initializedRef.current = false
			searchManager.setIsSearchOpen(false)
			fileSelection.clearSelection()
			return
		}

		if (initializedRef.current) {
			return
		}

		initializedRef.current = true

		setViewMode("workspace")
		workspaceManager.clearWorkspace()
		projectManager.clearProject()
		directoryNav.clearNavigation()
		searchManager.clearSearch()
		fileSelection.clearSelection()
		workspaceManager.refreshWorkspaces()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible])

	const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
	const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
		keyword: searchManager.fileName,
	})

	// 渲染工作区列表
	const renderWorkspaceList = () => {
		const shareWorkspace = SHARE_WORKSPACE_DATA(t)
		const myClawWorkspace = MY_CLAW_WORKSPACE_DATA(t)
		const allWorkspaces = [
			...workspaceManager.availableWorkspaces,
			shareWorkspace,
			myClawWorkspace,
		]

		const filteredWorkspaces =
			searchManager.isSearch && searchManager.fileName
				? allWorkspaces.filter((workspace) =>
						workspaceManager
							.getWorkspaceDisplayName(workspace)
							.toLowerCase()
							.includes(searchManager.fileName.toLowerCase()),
					)
				: allWorkspaces

		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"

		return (
			<>
				{filteredWorkspaces.length > 0 ? (
					filteredWorkspaces.map((workspace, index) => (
						<div
							key={workspace.id || index}
							className={textFolderItemClass}
							onClick={() => handleWorkspaceClick(workspace)}
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										<IconWorkspace />
									</div>
									<MagicEllipseWithTooltip
										title={workspaceManager.getWorkspaceDisplayName(workspace)}
										text={workspaceManager.getWorkspaceDisplayName(workspace)}
										className={nameClass}
										placement="topLeft"
									>
										{workspaceManager.getWorkspaceDisplayName(workspace)}
									</MagicEllipseWithTooltip>
								</div>
								<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
									<IconChevronRight
										className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
										size={16}
									/>
								</div>
							</div>
						</div>
					))
				) : searchManager.isSearch && searchManager.fileName ? (
					<EmptyStateBox>
						<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
							<IconFileSearch size={24} />
						</div>
						<div className="flex flex-col items-center gap-2 text-center">
							<div className="text-lg font-medium leading-7 text-foreground">
								{searchEmptyTitle}
							</div>
							<div className="text-center text-sm font-normal leading-5 text-foreground/35">
								{searchEmptyDescription}
							</div>
						</div>
					</EmptyStateBox>
				) : (
					<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
						<img src={EmptyFilesIcon} alt="" width={200} height={200} />
						<div className="text-sm leading-5 text-foreground/35">
							{t("selectPathModal.noWorkspace")}
						</div>
					</div>
				)}
			</>
		)
	}

	// 渲染项目列表
	const renderProjectList = () => {
		const filteredProjects =
			searchManager.isSearch && searchManager.fileName
				? projectManager.availableProjects.filter((project) =>
						projectManager
							.getProjectDisplayName(project)
							.toLowerCase()
							.includes(searchManager.fileName.toLowerCase()),
					)
				: projectManager.availableProjects

		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"

		return (
			<>
				{filteredProjects.length > 0 ? (
					filteredProjects.map((project, index) => (
						<div
							key={project.id || index}
							className={textFolderItemClass}
							onClick={() => handleProjectClick(project)}
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										<IconProject />
									</div>
									<MagicEllipseWithTooltip
										title={projectManager.getProjectDisplayName(project)}
										text={projectManager.getProjectDisplayName(project)}
										className={nameClass}
										placement="topLeft"
									>
										{projectManager.getProjectDisplayName(project)}
									</MagicEllipseWithTooltip>
								</div>
								<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
									<IconChevronRight
										className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
										size={16}
									/>
								</div>
							</div>
						</div>
					))
				) : searchManager.isSearch && searchManager.fileName ? (
					<EmptyStateBox>
						<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
							<IconFileSearch size={24} />
						</div>
						<div className="flex flex-col items-center gap-2 text-center">
							<div className="text-lg font-medium leading-7 text-foreground">
								{searchEmptyTitle}
							</div>
							<div className="text-center text-sm font-normal leading-5 text-foreground/35">
								{searchEmptyDescription}
							</div>
						</div>
					</EmptyStateBox>
				) : (
					<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
						<img src={EmptyFilesIcon} alt="" width={200} height={200} />
						<div className="text-sm leading-5 text-foreground/35">
							{t("selectPathModal.noProject")}
						</div>
					</div>
				)}
			</>
		)
	}

	// 渲染目录树（带文件选择）
	const renderDirectoryTree = () => {
		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-2 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"

		return (
			<>
				{directoryNav.directories.map((directory, index) => {
					const isSelected = directory.file_id
						? fileSelection.selectedFileIds.has(directory.file_id)
						: false
					return (
						<div
							key={directory.file_id || index}
							className={textFolderItemClass}
							onClick={(e) => {
								// shadcn/ui Checkbox 使用 button 元素
								if ((e.target as HTMLElement).closest("button[role='checkbox']")) {
									return
								}
								if (directory.is_directory && projectManager.currentSourceProject) {
									directoryNav.onDirectoryClick(
										directory,
										projectManager.currentSourceProject.id,
									)
								}
							}}
						>
							<Checkbox
								checked={isSelected}
								onCheckedChange={(checked) => {
									fileSelection.handleSelectFile(
										directory,
										checked === true,
										projectManager.currentSourceProject?.id,
									)
								}}
							/>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										{directory.is_directory ? (
											<img
												src={FoldIcon}
												alt="folder"
												width={14}
												height={14}
											/>
										) : (
											<MagicFileIcon
												type={directory.file_extension}
												size={14}
											/>
										)}
									</div>

									<MagicEllipseWithTooltip
										title={getItemName(directory)}
										text={getItemName(directory)}
										className={nameClass}
										placement="topLeft"
									>
										{getItemName(directory)}
									</MagicEllipseWithTooltip>
								</div>

								<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
									{searchManager.isSearch && directory.relative_file_path && (
										<MagicEllipseWithTooltip
											title={directory.relative_file_path}
											text={directory.relative_file_path}
											className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm leading-5 text-foreground/35"
											placement="rightTop"
										>
											{directory.relative_file_path}
										</MagicEllipseWithTooltip>
									)}
									{directory.is_directory && (
										<IconChevronRight
											className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
											size={16}
										/>
									)}
								</div>
							</div>
						</div>
					)
				})}
			</>
		)
	}

	const toolbarButtonClass =
		"inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm hover:bg-fill active:bg-fill-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-foreground"
	const breadcrumbItemBase =
		"relative flex max-w-[150px] cursor-pointer items-center rounded-[4px] text-foreground transition-colors hover:not(.disable):not(.current):text-primary [&.disable]:cursor-not-allowed [&.disable]:opacity-50"

	const modalContent = (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col overflow-hidden",
				isMobile && "h-[calc(100%-141px)]",
			)}
		>
			<div
				className="flex items-center justify-start gap-2.5 p-0"
				data-testid="import-from-other-project-modal-toolbar"
			>
				{!searchManager.isSearchOpen && (
					<div className="whitespace-nowrap text-sm font-medium leading-[14px] text-foreground">
						{t("selectPathModal.selectSourceFiles")}
					</div>
				)}
				{searchManager.isSearchOpen ? (
					<div className="flex h-[44px] min-w-0 flex-1 items-center gap-2">
						<div className="relative min-w-0 flex-1">
							<IconSearch
								size={16}
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								ref={searchManager.searchInputRef}
								className="h-8 rounded-lg border-border py-1 pl-9 pr-3 text-sm leading-5 placeholder:text-foreground/35 focus-visible:ring-0"
								placeholder={searchManager.searchPlaceholder}
								value={searchManager.fileName}
								onChange={(e) =>
									searchManager.searchDirectories(
										e,
										projectManager.currentSourceProject?.id,
									)
								}
								data-testid="import-from-other-project-modal-search-input"
							/>
						</div>
						<Button
							variant="outline"
							size="icon"
							className={toolbarButtonClass}
							onClick={() =>
								searchManager.handleToggleSearch(() =>
									searchManager.backCatalogueSelect({
										projectId: projectManager.currentSourceProject?.id,
										parentId:
											directoryNav.path.length > 0
												? directoryNav.path[directoryNav.path.length - 1]
														.file_id
												: undefined,
									}),
								)
							}
							aria-label={t("common.cancel")}
							data-testid="import-from-other-project-modal-search-close"
						>
							<IconX size={16} />
						</Button>
					</div>
				) : (
					<>
						{!searchManager.isSearch && (
							<div
								className={cn(
									"text-md mx-2.5 my-2.5 flex h-auto min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden",
									isMobile && "flex-wrap gap-y-1.5 overflow-visible",
								)}
								ref={breadcrumb.breadcrumbRef}
							>
								{breadcrumb.breadcrumbItems.map((item, i) => (
									<div key={i} className="flex items-center">
										{isEmpty(item.children) ? (
											<div
												className={cn(
													breadcrumbItemBase,
													directoryNav.loading && "disable",
												)}
												style={{
													maxWidth:
														breadcrumb.breadcrumbItems.length > 1
															? 470 /
																	(breadcrumb.breadcrumbItems
																		.length -
																		1) -
																24
															: undefined,
													cursor: directoryNav.loading
														? "not-allowed"
														: "pointer",
												}}
												onClick={() => breadcrumb.onBreadcrumbClick(item)}
											>
												<MagicEllipseWithTooltip
													title={item.name}
													text={item.name}
													className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"
													placement="topLeft"
												>
													{item.name}
												</MagicEllipseWithTooltip>
											</div>
										) : (
											<Dropdown
												placement="bottomLeft"
												trigger={["click"]}
												overlayStyle={{ zIndex: 9999 }}
												getPopupContainer={(trigger) =>
													trigger.parentElement || document.body
												}
												autoAdjustOverflow={false}
												dropdownRender={() => {
													return (
														<Menu
															style={{
																maxHeight: "250px",
																overflowY: "auto",
															}}
															onClick={(info) => {
																const index = parseInt(
																	info.key as string,
																	10,
																)
																const subitem =
																	item.children?.[index]
																if (subitem) {
																	breadcrumb.onBreadcrumbClick(
																		subitem,
																	)
																}
															}}
														>
															{item.children?.map((subitem, j) => (
																<Menu.Item
																	key={j}
																	className="rounded-md transition-colors hover:bg-fill active:bg-fill-secondary"
																>
																	<div
																		className="flex items-center"
																		style={{
																			paddingLeft: j * 12,
																		}}
																	>
																		<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
																			<img
																				src={FoldIcon}
																				alt="folder"
																				width={14}
																				height={14}
																			/>
																		</div>
																		<MagicEllipseWithTooltip
																			title={subitem.name}
																			text={subitem.name}
																			className="ml-2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
																			placement="topLeft"
																		>
																			{subitem.name}
																		</MagicEllipseWithTooltip>
																	</div>
																</Menu.Item>
															))}
														</Menu>
													)
												}}
											>
												<div
													className={cn(
														breadcrumbItemBase,
														"ellipsis p-0.5",
													)}
												>
													<IconDots
														className="mx-1 text-base text-muted-foreground"
														size={16}
													/>
												</div>
											</Dropdown>
										)}
										{i < breadcrumb.breadcrumbItems.length - 1 && (
											<IconChevronRight
												className="mx-1 text-xs text-muted-foreground"
												size={18}
											/>
										)}
									</div>
								))}
							</div>
						)}
						<div className="ml-auto flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className={toolbarButtonClass}
								onClick={() =>
									searchManager.handleToggleSearch(() =>
										searchManager.backCatalogueSelect({
											projectId: projectManager.currentSourceProject?.id,
											parentId:
												directoryNav.path.length > 0
													? directoryNav.path[
															directoryNav.path.length - 1
														].file_id
													: undefined,
										}),
									)
								}
								aria-label={searchManager.searchPlaceholder}
								data-testid="import-from-other-project-modal-search-toggle"
							>
								<IconSearch size={20} />
							</Button>
						</div>
					</>
				)}
			</div>
			<div className="mt-2.5 h-[360px] w-full overflow-y-auto overflow-x-hidden md:h-auto">
				<MagicSpin
					spinning={directoryNav.loading || projectManager.loading}
					className="h-full w-full"
				>
					{viewMode === "workspace" && renderWorkspaceList()}
					{viewMode === "project" && renderProjectList()}
					{viewMode === "directory" && (
						<>
							{!isEmpty(directoryNav.directories) ? (
								renderDirectoryTree()
							) : searchManager.isSearch ? (
								<EmptyStateBox>
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
										<IconFileSearch size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="text-lg font-medium leading-7 text-foreground">
											{searchEmptyTitle}
										</div>
										<div className="text-center text-sm font-normal leading-5 text-foreground/35">
											{searchEmptyDescription}
										</div>
									</div>
								</EmptyStateBox>
							) : (
								<EmptyStateBox>
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
										<IconFolder size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="flex flex-col gap-1.5 text-center text-sm font-normal leading-5 text-foreground/35">
											<span>{t("selectPathModal.emptyDataTip")}</span>
										</div>
									</div>
								</EmptyStateBox>
							)}
						</>
					)}
				</MagicSpin>
			</div>
		</div>
	)

	const footerConfig = {
		leftContent:
			viewMode === "directory" ? (
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2">
						<Checkbox
							checked={
								fileSelection.isIndeterminate(directoryNav.directories)
									? "indeterminate"
									: fileSelection.isAllSelected(directoryNav.directories)
							}
							onCheckedChange={(checked) => {
								if (checked === true) {
									fileSelection.selectAll(
										directoryNav.directories,
										projectManager.currentSourceProject?.id,
									)
								} else {
									fileSelection.deselectAll(directoryNav.directories)
								}
							}}
						/>
						<span className="text-sm text-foreground">{t("topicFiles.selectAll")}</span>
					</div>
				</div>
			) : undefined,
		okText: t("common.confirm"),
		cancelText: t("common.cancel"),
		onOk: submit,
		onCancel: handleCancel,
		okDisabled: !canSubmit,
	}

	return (
		<BaseModal
			visible={visible}
			title={t("selectPathModal.importFromOtherProject")}
			content={modalContent}
			footer={footerConfig}
			onClose={onClose}
			maskClosable={false}
		/>
	)
}

export default ImportFromOtherProjectModal
