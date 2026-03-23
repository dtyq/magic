import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react"
import { Button, Flex, Input, InputRef } from "antd"
import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicModal from "@/components/base/MagicModal"
import IconWorkspace from "@/pages/superMagic/components/icons/IconWorkspace"
import { SuperMagicApi } from "@/apis"
import { observer } from "mobx-react-lite"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import magicToast from "@/components/base/MagicToaster/utils"
import { Box } from "lucide-react"
interface MoveProjectPopupProps {
	open: boolean
	onClose: () => void
	onConfirm: (workspaceId: string) => void
}

function MoveProjectPopup({ open, onClose, onConfirm }: MoveProjectPopupProps) {
	const { t } = useTranslation("super")

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

	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace

	/* 过滤工作区 */
	const filteredWorkspaces = workspaces.filter(
		(workspace) =>
			workspace.name.toLowerCase().includes(searchValue.toLowerCase()) &&
			workspace.id !== selectedWorkspace?.id,
	)

	useEffect(() => {
		if (open) {
			SuperMagicService.workspace.fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: true,
				page: 1,
			})
			setSearchValue("")
		}
	}, [open])

	/** 新建工作区 */
	const handleCreateWorkspace = useMemoizedFn(() => {
		setSelectedWorkspaceId("")
		setIsCreatingWorkspace(true)
		setTimeout(() => {
			workspaceInputRef.current?.focus()
		}, 100)
	})

	/** 新建工作区输入框失去焦点事件 */
	const handleCreateWorkspaceConfirm = useMemoizedFn(async () => {
		if (isCreatingWorkspaceLoading) return
		try {
			const trimmedName = newWorkspaceName.trim()
			if (trimmedName) {
				setIsCreatingWorkspaceLoading(true)
				const res = await SuperMagicApi.createWorkspace({
					workspace_name: trimmedName,
				})
				if (res?.id) {
					SuperMagicService.workspace.fetchWorkspaces({
						isAutoSelect: false,
						isSelectLast: true,
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
				handleCreateWorkspaceConfirm()
			}
		},
	)

	/** 确定事件 */
	const handleConfirm = useMemoizedFn(() => {
		onConfirm(selectedWorkspaceId)
	})

	return (
		<MagicPopup bodyClassName={styles.container} visible={open} onClose={onClose}>
			<div className={styles.header}>
				<div>{t("hierarchicalWorkspacePopup.moveProjectTo")}...</div>
				<div className={styles.headerClose} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<div className={styles.content}>
				{filteredWorkspaces.length > 0 ? (
					filteredWorkspaces.map((workspace) => (
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
									<IconWorkspace />
								</div>
								<div className={styles.contentItemNameText}>
									{workspace.name || t("workspace.unnamedWorkspace")}
								</div>
							</div>
							{selectedWorkspaceId === workspace.id && (
								<IconCheck className={styles.contentItemCheck} size={20} />
							)}
						</div>
					))
				) : (
					<div className="flex flex-col items-center justify-center gap-2 py-10">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground">
							<Box className="size-6 text-background" />
						</div>
						<div className="text-xs text-muted-foreground">
							{t("workspace.noOtherWorkspace")}
						</div>
					</div>
				)}
			</div>
			<div className={styles.footer}>
				<Button className={styles.footerCreateButton} onClick={handleCreateWorkspace}>
					<IconPlus size={20} />
					<div>{t("workspace.createWorkspace")}</div>
				</Button>
				<Button
					className={styles.footerConfirmButton}
					type="primary"
					disabled={!selectedWorkspaceId}
					onClick={handleConfirm}
				>
					{t("hierarchicalWorkspacePopup.confirmMoveProject")}
				</Button>
			</div>

			<MagicModal
				title={t("workspace.createWorkspace")}
				okText={t("hierarchicalWorkspacePopup.create")}
				okButtonProps={{
					loading: isCreatingWorkspaceLoading,
					disabled: !newWorkspaceName.trim(),
				}}
				onCancel={() => setIsCreatingWorkspace(false)}
				onOk={handleCreateWorkspaceConfirm}
				open={isCreatingWorkspace}
				centered
			>
				<Flex vertical gap={10}>
					<div>
						{t("hierarchicalWorkspacePopup.name")}
						<span className={styles.contentItemInputRequired}>*</span>
					</div>
					<Input
						className={styles.contentItemInput}
						ref={workspaceInputRef}
						value={newWorkspaceName}
						placeholder={t("workspace.createWorkspaceTip")}
						maxLength={100}
						onChange={(e) => setNewWorkspaceName(e.target.value)}
						onKeyDown={handleCreateWorkspaceKeyDown}
					/>
				</Flex>
			</MagicModal>
		</MagicPopup>
	)
}

export default observer(MoveProjectPopup)
