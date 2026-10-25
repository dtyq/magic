import { useStyles } from "./styles"
import { message, Switch, Collapse, Flex } from "antd"
import { IconExternalLink, IconPencil, IconTrash } from "@tabler/icons-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useTranslation } from "react-i18next"
import TSIcon from "@/components/base/TSIcon"
import { LongMemory } from "@/types/longMemory"
import { useEffect, useState, useMemo, useCallback } from "react"
import NoDataImage from "@/assets/resources/defaultImages/no_data.svg"
import SmartTooltip from "@/components/other/SmartTooltip"
import { LongMemoryApi, SuperMagicApi } from "@/apis"
import { useMemoizedFn } from "ahooks"
import { LongTremMemoryPage, MemoryTypeTab } from "../../types"
import MagicModal from "@/components/base/MagicModal"
import MagicSpin from "@/components/base/MagicSpin"
import type { NavigateToStateParams } from "@/pages/superMagic/services/routeManageService"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import { useIsMobile } from "@/hooks/useIsMobile"
import magicToast from "@/components/base/MagicToaster/utils"

export default function Table({
	activeTab,
	setPage,
	setEditMemory,
	onWorkspaceStateChange,
	onClose,
	onMemoryChanged,
}: {
	activeTab: MemoryTypeTab
	setPage: (page: LongTremMemoryPage) => void
	setEditMemory: (memory: LongMemory.Memory) => void
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
	onClose: () => void
	onMemoryChanged?: () => void
}) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	/** Global memories. */
	const [globalMemoryList, setGlobalMemoryList] = useState<LongMemory.Memory[]>([])
	/** Project memories. */
	const [projectMemoryList, setProjectMemoryList] = useState<LongMemory.Memory[]>([])
	/** Loading state. */
	const [loading, setLoading] = useState(false)
	/** Page size. */
	const [pageSize] = useState(99)
	/** Prevent concurrent project navigation. */
	const [isProjectNavigateLoading, setIsProjectNavigateLoading] = useState(false)

	/** Fetch memories and separate them by scope. */
	const fetchAllMemories = useCallback(async (currentPageSize: number = 10) => {
		try {
			setLoading(true)
			const res = await LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.ACTIVE, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: currentPageSize,
			})
			// Separate global and project memories.
			const globalMemories = res.data.filter((memory) => memory.project_id === null)
			const projectMemories = res.data.filter((memory) => memory.project_id !== null)
			setGlobalMemoryList(globalMemories)
			setProjectMemoryList(projectMemories)
		} catch (error) {
			console.error(error)
		} finally {
			setLoading(false)
		}
	}, [])

	/** Enable or disable a memory. */
	const handleEnabledChange = useMemoizedFn(async (id: string, enabled: boolean) => {
		try {
			const res = await LongMemoryApi.batchEnableMemories([id], enabled)
			if (res) {
				// Update the memory in both scope lists.
				setGlobalMemoryList((prev) =>
					prev.map((memory) => (memory.id === id ? { ...memory, enabled } : memory)),
				)
				setProjectMemoryList((prev) =>
					prev.map((memory) => (memory.id === id ? { ...memory, enabled } : memory)),
				)
				onMemoryChanged?.()
				magicToast.success(enabled ? t("enabledSuccess") : t("disabledSuccess"))
			}
		} catch (error) {
			console.log("🚀 ~ handleEnabledChange ~ error:", error)
		}
	})

	/** Edit a memory. */
	const handleMemoryEdit = useMemoizedFn((memory: LongMemory.Memory) => {
		setPage(LongTremMemoryPage.CreateOrEdit)
		setEditMemory(memory)
	})

	/** Confirm memory deletion. */
	const handleMemoryDeleteConfirm = useMemoizedFn(async (memory: LongMemory.Memory) => {
		MagicModal.confirm({
			title: t("deleteMemoryConfirm"),
			content: t("deleteMemoryConfirmContent"),
			variant: "destructive",
			showIcon: true,
			centered: true,
			okText: t("confirm"),
			onOk: () => handleMemoryDelete(memory.id),
		})
	})

	/** Delete the confirmed memory. */
	const handleMemoryDelete = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.deleteMemory(memoryId)
			if (res) {
				// Remove the memory from both scope lists.
				setGlobalMemoryList((prev) => prev.filter((memory) => memory.id !== memoryId))
				setProjectMemoryList((prev) => prev.filter((memory) => memory.id !== memoryId))
				onMemoryChanged?.()
				magicToast.success(t("deleteSuccess"))
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryDelete ~ error:", error)
		}
	})

	/** Render full memory text in the tooltip. */
	const getMemoryTooltipContent = (content: string) => {
		return <div className={styles.memoryTooltipContent}>{content}</div>
	}

	/** Render a memory row. */
	const MemoryItem = ({
		memory,
		isProjectMemory,
		isLastProjectMemory,
	}: {
		memory: LongMemory.Memory
		isProjectMemory?: boolean
		isLastProjectMemory?: boolean
	}) => (
		<div key={memory.id} className={styles.item}>
			<div
				className={cx(
					styles.itemCell,
					styles.itemName,
					isProjectMemory && styles.itemProjectName,
					isLastProjectMemory && styles.itemLastProject,
				)}
			>
				<TSIcon type="ts-txt" size="18" />
				<SmartTooltip
					className={styles.text}
					content={getMemoryTooltipContent(memory.content)}
				>
					{memory.content}
				</SmartTooltip>
				<div className={styles.tag}>{t("text")}</div>
			</div>
			<div
				className={cx(
					styles.itemCell,
					styles.itemStatus,
					isLastProjectMemory && styles.itemLastProject,
				)}
			>
				<Switch
					checked={memory.enabled}
					onChange={(enabled) => handleEnabledChange(memory.id, enabled)}
					size="small"
				/>
			</div>
			<div
				className={cx(
					styles.itemCell,
					styles.itemSetting,
					isLastProjectMemory && styles.itemLastProject,
				)}
			>
				<div
					className={styles.button}
					onClick={() => handleMemoryEdit(memory)}
					data-testid="handle-memory-edit"
				>
					<IconPencil size={20} strokeWidth={1.5} />
				</div>
				<div
					className={styles.button}
					onClick={() => handleMemoryDeleteConfirm(memory)}
					data-testid="handle-memory-delete-confirm"
				>
					<IconTrash size={20} strokeWidth={1.5} />
				</div>
			</div>
		</div>
	)

	/** Select the active scope list. */
	const currentMemoryList = useMemo(() => {
		return activeTab === MemoryTypeTab.GlobalMemory ? globalMemoryList : projectMemoryList
	}, [activeTab, globalMemoryList, projectMemoryList])

	/** Group memories by project. */
	const groupedProjectMemories = useMemo(() => {
		if (activeTab !== MemoryTypeTab.ProjectMemory) return {}
		return projectMemoryList.reduce(
			(groups, memory) => {
				const projectId = memory.project_id || "unknown"
				const projectName = memory.project_name || t("unknownProject")

				if (!groups[projectId]) {
					groups[projectId] = {
						projectName,
						memories: [],
					}
				}
				groups[projectId].memories.push(memory)
				return groups
			},
			{} as Record<string, { projectName: string; memories: LongMemory.Memory[] }>,
		)
	}, [projectMemoryList, activeTab, t])

	/** Navigate to the associated project. */
	const handleProjectClick = useMemoizedFn(
		async (e: React.MouseEvent<SVGSVGElement, MouseEvent>, projectId: string) => {
			if (isProjectNavigateLoading) return
			try {
				e.stopPropagation()
				e.preventDefault()
				setIsProjectNavigateLoading(true)
				const res = await SuperMagicApi.getProjectDetail({ id: projectId })
				if (res) {
					if (isMobile) {
						onClose()
						onWorkspaceStateChange({
							workspaceId: res.workspace_id,
							projectId,
							topicId: null,
						})
					} else {
						openProjectInNewTab(res)
					}
				}
			} catch (error) {
				console.log("🚀 ~ handleProjectClick ~ error:", error)
			} finally {
				setIsProjectNavigateLoading(false)
			}
		},
	)

	useEffect(() => {
		fetchAllMemories(pageSize)
	}, [pageSize])

	if (loading) {
		return (
			<div className={styles.empty}>
				<MagicSpin spinning />
				<div>{t("loading")}</div>
			</div>
		)
	}

	if (currentMemoryList.length === 0) {
		return (
			<div className={styles.empty}>
				<img src={NoDataImage} draggable={false} alt="" data-testid="table-image" />
				<div>{t("noData")}</div>
			</div>
		)
	}

	if (activeTab === MemoryTypeTab.ProjectMemory) {
		const projectGroups = Object.entries(groupedProjectMemories)

		if (projectGroups.length === 0) {
			return (
				<div className={styles.empty}>
					<img src={NoDataImage} draggable={false} alt="" data-testid="table-image-2" />
					<div>{t("noData")}</div>
				</div>
			)
		}

		return (
			<div className={styles.wrapper}>
				<div className={styles.table}>
					<div className={cx(styles.item, styles.tableHeader)}>
						<div className={cx(styles.itemCell, styles.itemName)}>{t("content")}</div>
						<div className={cx(styles.itemCell, styles.itemStatus)}>{t("status")}</div>
						<div className={cx(styles.itemCell, styles.itemSetting)}>{t("action")}</div>
					</div>
					<ScrollArea
						className={styles.scroll}
						viewportClassName={styles.scrollViewport}
						type="always"
					>
						<Collapse
							className={styles.projectCollapse}
							ghost
							defaultActiveKey={projectGroups.map(([projectId]) => projectId)}
							items={projectGroups.map(([projectId, { projectName, memories }]) => ({
								key: projectId,
								label: (
									<Flex align="center" gap={8}>
										<div>{projectName}</div>
										<IconExternalLink
											onClick={(e) => handleProjectClick(e, projectId)}
											size={16}
											strokeWidth={1}
										/>
									</Flex>
								),
								children: (
									<div>
										{memories.map((memory, index) => (
											<MemoryItem
												key={memory.id}
												memory={memory}
												isProjectMemory={true}
												isLastProjectMemory={index === memories.length - 1}
											/>
										))}
									</div>
								),
							}))}
						/>
					</ScrollArea>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.table}>
				<div className={cx(styles.item, styles.tableHeader)}>
					<div className={cx(styles.itemCell, styles.itemName)}>{t("content")}</div>
					<div className={cx(styles.itemCell, styles.itemStatus)}>{t("status")}</div>
					<div className={cx(styles.itemCell, styles.itemSetting)}>{t("action")}</div>
				</div>
				<ScrollArea
					className={styles.scroll}
					viewportClassName={styles.scrollViewport}
					type="always"
				>
					{currentMemoryList.map((memory) => (
						<MemoryItem key={memory.id} memory={memory} />
					))}
				</ScrollArea>
			</div>
			{/* Pagination can be added in a future iteration. */}
			{/* <div className={styles.pagination}>
				<Pagination
					pageSize={pageSize}
					total={total}
					showTitle={false}
					showQuickJumper={false}
				/>
			</div> */}
		</div>
	)
}
