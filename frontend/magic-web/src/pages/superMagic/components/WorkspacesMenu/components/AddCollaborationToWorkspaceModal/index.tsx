import MagicModal from "@/components/base/MagicModal"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react"
import { Button, Flex, Input, InputRef } from "antd"
import { useEffect, useMemo, useRef, useState } from "react"
import { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import IconProject from "../../../icons/IconProject"
import { useMemoizedFn } from "ahooks"
import { type FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

interface AddCollaborationToWorkspaceModalProps {
	workspaces: Workspace[]
	isMoveProjectLoading: boolean
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
	open: boolean
	onClose: () => void
	onConfirm: (workspaceId: string) => void
}

export function AddCollaborationToWorkspaceModal({
	workspaces,
	isMoveProjectLoading,
	fetchWorkspaces,
	open,
	onClose,
	onConfirm,
}: AddCollaborationToWorkspaceModalProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const { styles, cx } = useStyles()

	/* 选中工作区 */
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
	/* 搜索工作区 */
	const [searchValue, setSearchValue] = useState("")
	/** 是否正在新建工作区 */
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	/** 是否正在新建工作区 */
	const [isCreatingWorkspaceLoading, setIsCreatingWorkspaceLoading] = useState(false)
	/** 新建工作区输入框ref */
	const workspaceInputRef = useRef<InputRef>(null)
	/** 新建工作区名称 */
	const [newWorkspaceName, setNewWorkspaceName] = useState("")

	/** 关闭弹窗时重置状态 */
	useEffect(() => {
		if (!open) {
			setSelectedWorkspaceId("")
			setSearchValue("")
			setNewWorkspaceName("")
			setIsCreatingWorkspace(false)
			setIsCreatingWorkspaceLoading(false)
		}
	}, [open])

	useEffect(() => {
		if (open) {
			fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: false,
				isEditLast: false,
				page: 1,
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	/* 过滤工作区 */
	const filteredWorkspaces = useMemo(() => {
		return workspaces.filter((workspace) =>
			workspace.name.toLowerCase().includes(searchValue.toLowerCase()),
		)
	}, [workspaces, searchValue])

	/** 新建工作区 */
	const handleCreateWorkspace = useMemoizedFn(() => {
		setSelectedWorkspaceId("")
		setIsCreatingWorkspace(true)
		setTimeout(() => {
			workspaceInputRef.current?.focus()
		}, 100)
	})

	/** 新建工作区输入框失去焦点事件 */
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
					fetchWorkspaces({
						isAutoSelect: false,
						isSelectLast: false,
						isEditLast: false,
						page: 1,
					})
					magicToast.success(t("hierarchicalWorkspacePopup.createSuccess"))
					setSelectedWorkspaceId(res.id)
				}
			}
			setIsCreatingWorkspace(false)
			setNewWorkspaceName("")
		} catch (error) {
			console.error(error)
		} finally {
			setIsCreatingWorkspaceLoading(false)
		}
	})

	/** 新建工作区输入框回车事件 */
	const handleCreateWorkspaceKeyDown = useMemoizedFn(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				handleCreateWorkspaceBlur()
			}
		},
	)

	/** 确定事件 */
	const handleConfirm = useMemoizedFn(() => {
		onConfirm(selectedWorkspaceId)
	})

	const Content = (
		<>
			<div className={styles.header}>
				<div>{t("project.addWorkspaceShortcut")}</div>
				<div className={styles.headerClose} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<div className={styles.content}>
				<div className={styles.contentSearch}>
					<Input
						prefix={<IconSearch className={styles.contentSearchIcon} size={16} />}
						placeholder={t("workspace.searchWorkspace")}
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
					/>
				</div>
				<div className={styles.contentList}>
					{isCreatingWorkspace && (
						<div className={styles.contentItem}>
							<div className={styles.contentItemName}>
								<div className={styles.contentItemIcon}>
									<IconProject />
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
								/>
							</div>
						</div>
					)}
					{filteredWorkspaces.map((workspace) => (
						<div
							key={workspace.id}
							className={cx(
								styles.contentItem,
								selectedWorkspaceId === workspace.id && styles.contentItemSelected,
							)}
							onClick={() => setSelectedWorkspaceId(workspace.id)}
						>
							<div className={styles.contentItemName}>
								<div className={styles.contentItemIcon}>
									<IconProject />
								</div>
								<div className={styles.contentItemNameText}>
									{workspace.name || t("workspace.unnamedWorkspace")}
								</div>
							</div>
							{selectedWorkspaceId === workspace.id && (
								<IconCheck className={styles.contentItemCheck} size={20} />
							)}
						</div>
					))}
				</div>
			</div>
			<div className={styles.footer}>
				<Button className={styles.footerCreateButton} onClick={handleCreateWorkspace}>
					{t("workspace.createWorkspace")}
				</Button>
				<Flex align="center" gap={12}>
					<Button className={styles.footerCancelButton} onClick={onClose}>
						{t("common.cancel")}
					</Button>
					<Button
						className={styles.footerConfirmButton}
						type="primary"
						disabled={!selectedWorkspaceId}
						loading={isMoveProjectLoading}
						onClick={handleConfirm}
					>
						{t("common.determine")}
					</Button>
				</Flex>
			</div>
		</>
	)

	if (isMobile) {
		return (
			<MagicPopup visible={open} style={{ zIndex: 1002 }} onClose={onClose}>
				{Content}
			</MagicPopup>
		)
	}

	return (
		<MagicModal
			width={700}
			className={styles.container}
			open={open}
			onCancel={onClose}
			footer={null}
			closeIcon={null}
			centered
		>
			{Content}
		</MagicModal>
	)
}

export default AddCollaborationToWorkspaceModal
