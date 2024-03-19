import MagicModal from "@/opensource/components/base/MagicModal"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { IconCheck, IconSearch, IconX, IconFolderPlus, IconFileSearch } from "@tabler/icons-react"
import { Button, Checkbox, Flex, Input, type InputRef } from "antd"
import { useEffect, useMemo, useRef, useState } from "react"
import { Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useMemoizedFn } from "ahooks"
import { type FetchWorkspacesParams } from "@/opensource/pages/superMagic/hooks/useWorkspace"
import { useWorkspaceCreation } from "./hooks/useWorkspaceCreation"
import IconWorkspace from "../../../icons/IconWorkspace"

interface MoveProjectModalProps {
	workspaces: Workspace[]
	selectedWorkspace?: Workspace | null
	isMoveProjectLoading: boolean
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
	open: boolean
	onClose: () => void
	onConfirm: (workspaceId: string) => void
}

export default function MoveProjectModal({
	workspaces,
	selectedWorkspace,
	isMoveProjectLoading,
	fetchWorkspaces,
	open,
	onClose,
	onConfirm,
}: MoveProjectModalProps) {
	const { t } = useTranslation("super")

	const { styles, cx } = useStyles()

	/* 选中工作区 */
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
	/* 搜索工作区 */
	const [searchValue, setSearchValue] = useState("")
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const searchInputRef = useRef<InputRef>(null)

	/* 工作区创建逻辑 */
	const {
		isCreatingWorkspace,
		isCreatingWorkspaceLoading,
		newWorkspaceName,
		workspaceInputRef,
		setNewWorkspaceName,
		handleStartCreation,
		handleCancelCreation,
		handleCreateWorkspaceBlur,
		handleCreateWorkspaceKeyDown,
	} = useWorkspaceCreation({
		fetchWorkspaces,
		onWorkspaceCreated: (workspaceId) => {
			setSelectedWorkspaceId(workspaceId)
		},
	})

	/* 过滤工作区 */
	const filteredWorkspaces = useMemo(() => {
		return workspaces.filter(
			(workspace) =>
				workspace.name.toLowerCase().includes(searchValue.toLowerCase()) &&
				workspace.id !== selectedWorkspace?.id,
		)
	}, [workspaces, searchValue, selectedWorkspace])
	const isSearchEmpty =
		isSearchOpen && !!searchValue && filteredWorkspaces.length === 0 && !isCreatingWorkspace

	/** Handle create workspace click */
	const handleCreateWorkspace = useMemoizedFn(() => {
		setSelectedWorkspaceId("")
		handleStartCreation()
	})

	const handleToggleSearch = useMemoizedFn(() => {
		if (isSearchOpen) {
			setIsSearchOpen(false)
			setSearchValue("")
			return
		}

		setIsSearchOpen(true)
	})

	useEffect(() => {
		if (isSearchOpen) {
			searchInputRef.current?.focus()
		}
	}, [isSearchOpen])

	/** 确定事件 */
	const handleConfirm = useMemoizedFn(() => {
		onConfirm(selectedWorkspaceId)
	})
	const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
	const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
		keyword: searchValue,
	})

	return (
		<MagicModal
			width={720}
			className={styles.container}
			open={open}
			onCancel={onClose}
			footer={null}
			closeIcon={null}
			centered
		>
			<div className={styles.header} data-testid="move-project-modal-header">
				<div data-testid="move-project-modal-title">{t("project.moveProjectTitle")}</div>
				<div
					className={styles.headerClose}
					onClick={onClose}
					data-testid="move-project-modal-close-button"
				>
					<IconX size={16} />
				</div>
			</div>
			<div className={styles.content} data-testid="move-project-modal-content">
				<div
					className={styles.contentHeader}
					data-testid="move-project-modal-content-header"
				>
					{isSearchOpen ? (
						<div
							className={styles.contentSearchExpanded}
							data-testid="move-project-modal-search-expanded"
						>
							<div
								className={styles.contentSearch}
								data-testid="move-project-modal-search-wrapper"
							>
								<Input
									ref={searchInputRef}
									prefix={
										<IconSearch
											className={styles.contentSearchIcon}
											size={16}
										/>
									}
									placeholder={t("workspace.searchWorkspace")}
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									data-testid="move-project-modal-search-input"
								/>
							</div>
							<Button
								className={styles.contentSearchButton}
								onClick={handleToggleSearch}
								aria-label={t("common.cancel")}
								data-testid="move-project-modal-search-close"
							>
								<IconX size={16} />
							</Button>
						</div>
					) : (
						<>
							<div
								className={styles.contentTitle}
								data-testid="move-project-modal-content-title"
							>
								{t("workspace.selectWorkspaceForStorage")}
							</div>
							<div
								className={styles.contentToolbar}
								data-testid="move-project-modal-toolbar"
							>
								<Button
									className={styles.contentCreateButton}
									onClick={handleCreateWorkspace}
									data-testid="move-project-modal-create-workspace-button"
									aria-label={t("workspace.createWorkspace")}
								>
									<IconFolderPlus size={20} />
								</Button>
								<Button
									className={styles.contentSearchButton}
									onClick={handleToggleSearch}
									aria-label={t("workspace.searchWorkspace")}
									data-testid="move-project-modal-search-toggle"
								>
									<IconSearch size={20} />
								</Button>
							</div>
						</>
					)}
				</div>
				<div className={styles.contentList} data-testid="move-project-modal-workspace-list">
					{isSearchEmpty ? (
						<div
							className={styles.emptyBlock}
							data-testid="move-project-modal-search-empty"
						>
							<div className={styles.emptyStateContainer}>
								<div className={styles.emptyStateIcon}>
									<IconFileSearch size={24} />
								</div>
								<div className={styles.emptyStateMessage}>
									<div className={styles.emptySearchTitle}>
										{searchEmptyTitle}
									</div>
									<div className={styles.emptySearchDescription}>
										{searchEmptyDescription}
									</div>
								</div>
							</div>
						</div>
					) : (
						<>
							{isCreatingWorkspace && (
								<div
									className={styles.contentItem}
									data-testid="move-project-modal-create-workspace-item"
								>
									<div className={styles.contentItemName}>
										<div className={styles.contentItemIcon}>
											<IconWorkspace />
										</div>
										<Input
											className={styles.contentItemInput}
											ref={workspaceInputRef}
											value={newWorkspaceName}
											onBlur={handleCreateWorkspaceBlur}
											onKeyDown={handleCreateWorkspaceKeyDown}
											placeholder={t("workspace.createWorkspaceTip")}
											maxLength={100}
											onChange={(e) => setNewWorkspaceName(e.target.value)}
											data-testid="move-project-modal-create-workspace-input"
										/>
									</div>
									<div className={styles.contentItemActions}>
										<Button
											className={styles.contentItemActionButton}
											onMouseDown={(event) => event.preventDefault()}
											onClick={handleCreateWorkspaceBlur}
											loading={isCreatingWorkspaceLoading}
											disabled={isCreatingWorkspaceLoading}
											data-testid="move-project-modal-create-workspace-confirm"
										>
											<IconCheck
												className={styles.contentItemActionIconConfirm}
												size={14}
											/>
										</Button>
										<Button
											className={styles.contentItemActionButton}
											onMouseDown={(event) => event.preventDefault()}
											onClick={handleCancelCreation}
											disabled={isCreatingWorkspaceLoading}
											data-testid="move-project-modal-create-workspace-cancel"
										>
											<IconX
												className={styles.contentItemActionIconCancel}
												size={14}
											/>
										</Button>
									</div>
								</div>
							)}
							{filteredWorkspaces.map((workspace, index) => (
								<div
									key={workspace.id}
									className={cx(
										styles.contentItem,
										selectedWorkspaceId === workspace.id &&
											styles.contentItemSelected,
									)}
									onClick={() => setSelectedWorkspaceId(workspace.id)}
									data-testid="move-project-modal-workspace-item"
									data-workspace-name={workspace.name}
									data-index={index}
									data-selected={selectedWorkspaceId === workspace.id}
								>
									<div className={styles.contentItemName}>
										<div className={styles.contentItemIcon}>
											<IconWorkspace />
										</div>
										<div className={styles.contentItemNameText}>
											{workspace.name || t("workspace.unnamedWorkspace")}
										</div>
									</div>
									{selectedWorkspaceId === workspace.id && (
										<Checkbox
											checked
											className={styles.contentItemCheckbox}
											data-testid="move-project-modal-workspace-checkbox"
										/>
									)}
								</div>
							))}
						</>
					)}
				</div>
			</div>
			<div className={styles.footer} data-testid="move-project-modal-footer">
				<Flex align="center" gap={6}>
					<Button
						className={styles.footerCancelButton}
						onClick={onClose}
						data-testid="move-project-modal-cancel-button"
					>
						{t("common.cancel")}
					</Button>
					<Button
						className={styles.footerConfirmButton}
						type="primary"
						disabled={!selectedWorkspaceId}
						loading={isMoveProjectLoading}
						onClick={handleConfirm}
						data-testid="move-project-modal-confirm-button"
						data-disabled={!selectedWorkspaceId}
						data-loading={isMoveProjectLoading}
					>
						{t("common.determine")}
					</Button>
				</Flex>
			</div>
		</MagicModal>
	)
}
