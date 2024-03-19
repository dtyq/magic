import { useStyles } from "./styles"
import { message, Switch, Collapse, Flex } from "antd"
import { IconExternalLink, IconPencil, IconTrash } from "@tabler/icons-react"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import { useTranslation } from "react-i18next"
import TSIcon from "@/opensource/components/base/TSIcon"
import { LongMemory } from "@/opensource/types/longMemory"
import { useEffect, useState, useMemo, useCallback } from "react"
import NoDataImage from "@/opensource/assets/resources/defaultImages/no_data.svg"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import { LongMemoryApi, SuperMagicApi } from "@/opensource/apis"
import { useMemoizedFn } from "ahooks"
import { LongTremMemoryPage, MemoryTypeTab } from "../../types"
import MagicModal from "@/opensource/components/base/MagicModal"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import type { NavigateToStateParams } from "@/opensource/pages/superMagic/services/routeManageService"
import { openProjectInNewTab } from "@/opensource/pages/superMagic/utils/project"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export default function Table({
	activeTab,
	setPage,
	setEditMemory,
	onWorkspaceStateChange,
	onClose,
}: {
	activeTab: MemoryTypeTab
	setPage: (page: LongTremMemoryPage) => void
	setEditMemory: (memory: LongMemory.Memory) => void
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
	onClose: () => void
}) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	/** 全局记忆列表 */
	const [globalMemoryList, setGlobalMemoryList] = useState<LongMemory.Memory[]>([])
	/** 项目记忆列表 */
	const [projectMemoryList, setProjectMemoryList] = useState<LongMemory.Memory[]>([])
	/** 加载状态 */
	const [loading, setLoading] = useState(false)
	/** 分页信息 */
	const [pageSize] = useState(99)
	/** 项目记忆的项目跳转状态 */
	const [isProjectNavigateLoading, setIsProjectNavigateLoading] = useState(false)

	/** 获取所有记忆列表并分类存储 */
	const fetchAllMemories = useCallback(async (currentPageSize: number = 10) => {
		try {
			setLoading(true)
			const res = await LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.ACTIVE, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: currentPageSize,
			})
			// 分类存储数据
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

	/** 启用/禁用记忆 */
	const handleEnabledChange = useMemoizedFn(async (id: string, enabled: boolean) => {
		try {
			const res = await LongMemoryApi.batchEnableMemories([id], enabled)
			if (res) {
				// 更新两个状态中的记忆
				setGlobalMemoryList((prev) =>
					prev.map((memory) => (memory.id === id ? { ...memory, enabled } : memory)),
				)
				setProjectMemoryList((prev) =>
					prev.map((memory) => (memory.id === id ? { ...memory, enabled } : memory)),
				)
				magicToast.success(enabled ? t("enabledSuccess") : t("disabledSuccess"))
			}
		} catch (error) {
			console.log("🚀 ~ handleEnabledChange ~ error:", error)
		}
	})

	/** 编辑记忆 */
	const handleMemoryEdit = useMemoizedFn((memory: LongMemory.Memory) => {
		setPage(LongTremMemoryPage.CreateOrEdit)
		setEditMemory(memory)
	})

	/** 删除记忆 */
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

	/** 确认删除记忆 */
	const handleMemoryDelete = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.deleteMemory(memoryId)
			if (res) {
				// 从两个状态中移除记忆
				setGlobalMemoryList((prev) => prev.filter((memory) => memory.id !== memoryId))
				setProjectMemoryList((prev) => prev.filter((memory) => memory.id !== memoryId))
				magicToast.success(t("deleteSuccess"))
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryDelete ~ error:", error)
		}
	})

	/** 获取记忆tooltip内容 */
	const getMemoryTooltipContent = (content: string) => {
		return <div className={styles.memoryTooltipContent}>{content}</div>
	}

	/** 记忆列表项组件 */
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
				<div className={styles.button} onClick={() => handleMemoryEdit(memory)}>
					<IconPencil size={20} strokeWidth={1.5} />
				</div>
				<div className={styles.button} onClick={() => handleMemoryDeleteConfirm(memory)}>
					<IconTrash size={20} strokeWidth={1.5} />
				</div>
			</div>
		</div>
	)

	/** 获取当前激活的记忆列表 */
	const currentMemoryList = useMemo(() => {
		return activeTab === MemoryTypeTab.GlobalMemory ? globalMemoryList : projectMemoryList
	}, [activeTab, globalMemoryList, projectMemoryList])

	/** 按项目分组项目记忆 */
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

	/** 点击项目跳转 */
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
				<img src={NoDataImage} draggable={false} alt="" />
				<div>{t("noData")}</div>
			</div>
		)
	}

	if (activeTab === MemoryTypeTab.ProjectMemory) {
		const projectGroups = Object.entries(groupedProjectMemories)

		if (projectGroups.length === 0) {
			return (
				<div className={styles.empty}>
					<img src={NoDataImage} draggable={false} alt="" />
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
					<MagicScrollBar className={styles.scroll} autoHide={false}>
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
					</MagicScrollBar>
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
				<MagicScrollBar className={styles.scroll} autoHide={false}>
					{currentMemoryList.map((memory) => (
						<MemoryItem key={memory.id} memory={memory} />
					))}
				</MagicScrollBar>
			</div>
			{/* 分页功能后续可拓展 */}
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
