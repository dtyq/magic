import { useState, useEffect } from "react"
import { Input, Button, Modal, Spin, theme as antTheme } from "antd"
import {
	IconGripVertical,
	IconEdit,
	IconTrash,
	IconArrowLeft,
	IconSearch,
	IconX,
} from "@tabler/icons-react"
import { DndProvider, useDrag, useDrop } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { useStyles } from "./styles"
import IconViewComponent from "@/pages/superMagic/components/IconViewComponent"
import { useMemoizedFn } from "ahooks"
import { DraggableCommonAgentProps, Agent, DragItem, AgentType, IconType } from "./types"
import AddAgentIcon from "@/pages/superMagic/assets/svg/addAgentIcon.svg"
import { useTranslation } from "react-i18next"
import pubsub from "@/utils/pubsub"
import { getModeBgColor } from "@/pages/superMagic/components/TopicMode/modeColor"
import { SuperMagicApi } from "@/apis"
import SmartTooltip from "@/components/other/SmartTooltip"
import magicToast from "@/components/base/MagicToaster/utils"

// Drop Indicator Component
function DropIndicator({ isVisible }: { isVisible: boolean }) {
	const { styles } = useStyles()

	// if (!isVisible) return null

	return (
		<div className={styles.dropIndicator} style={{ display: isVisible ? "block" : "none" }} />
	)
}

// Drag and drop types
const ItemTypes = {
	AGENT: "agent",
}

// 创建自定义模式数据
function createCustomAgent(t: (key: string) => string): Agent {
	return {
		id: "create-custom",
		name: t("agentEditor.agentSelector.createCustomAgent"),
		description: t("agentEditor.agentSelector.createCustomAgentDesc"),
		icon: { type: "", color: "", url: "" },
		icon_type: IconType.Icon,
		type: AgentType.Public,
	}
}

function DraggableCommonAgent({
	agent,
	index,
	onRemoveFromFavorites,
	onMoveAgent,
	onDropFromOtherList,
	onAgentClick,
}: DraggableCommonAgentProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const [{ isDragging }, drag] = useDrag({
		type: ItemTypes.AGENT,
		item: () => ({
			type: ItemTypes.AGENT,
			agent,
			sourceList: "common" as const,
			index,
		}),
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.AGENT,
		drop: (item: DragItem) => {
			// Handle drop from other list
			if (item.sourceList !== "common") {
				onDropFromOtherList(item, index)
			} else if (item.sourceList === "common" && item.index !== index) {
				// Same list reordering - only execute on drop
				onMoveAgent(item.index, index, "common", "common")
			}
		},
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
	})

	const showDropIndicator = isOver && canDrop

	return (
		<div ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
			<DropIndicator isVisible={showDropIndicator} />
			<div className={styles.agentCard}>
				<div className={styles.agentCardContent}>
					<IconGripVertical className={styles.dragHandle} />
					<div
						className={styles.agentIcon}
						style={{
							backgroundColor:
								agent.icon_type === IconType.Image
									? agent.icon?.color
									: getModeBgColor(agent.icon?.color, 0.1),
						}}
					>
						<IconViewComponent
							selectedIcon={agent.icon?.type}
							iconColor={agent.icon?.color}
							iconType={agent.icon_type}
							iconUrl={agent.icon?.url}
							size={28}
						/>
					</div>
					<SmartTooltip className={styles.agentName} maxLines={2}>
						{agent.name}
					</SmartTooltip>
					<div className={styles.agentActions}>
						{agent?.type !== AgentType?.buildIn &&
							agent?.type !== AgentType?.Public && (
								<Button
									type="text"
									size="small"
									icon={<IconEdit size={18} />}
									className={styles.actionButton}
									onClick={(e) => {
										e.stopPropagation()
										onAgentClick(agent)
									}}
								/>
							)}
						<Button
							type="text"
							size="small"
							className={styles.actionButton}
							onClick={(e) => onRemoveFromFavorites(agent.id, e)}
						>
							{t("agentEditor.agentSelector.removeFromFavorites")}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

// Draggable Agent Item Component for All Agents
interface DraggableAllAgentProps {
	agent: Agent
	index: number
	onDeleteAgent: (agentId: string, e: React.MouseEvent) => void
	onMoveAgent: (
		dragIndex: number,
		hoverIndex: number,
		sourceList: "common" | "all",
		targetList: "common" | "all",
	) => void
	onAgentClick: (agent: Agent) => void
	onDropFromOtherList: (item: DragItem, targetIndex: number) => void
}

function DraggableAllAgent({
	agent,
	index,
	onDeleteAgent,
	onMoveAgent,
	onAgentClick,
	onDropFromOtherList,
}: DraggableAllAgentProps) {
	const { styles } = useStyles()

	const [{ isDragging }, drag] = useDrag({
		type: ItemTypes.AGENT,
		item: () => ({
			type: ItemTypes.AGENT,
			agent,
			sourceList: "all" as const,
			index,
		}),
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.AGENT,
		drop: (item: DragItem) => {
			// Handle drop from other list
			if (item.sourceList !== "all") {
				onDropFromOtherList(item, index)
			} else if (item.sourceList === "all" && item.index !== index) {
				// Same list reordering - only execute on drop
				onMoveAgent(item.index, index, "all", "all")
			}
		},
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
	})

	const showDropIndicator = isOver && canDrop

	return (
		<div ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
			<DropIndicator isVisible={showDropIndicator} />
			<div
				className={styles.allAgentListItem}
				onClick={() => {
					if (agent?.type === AgentType.buildIn || agent?.type === AgentType.Public)
						return
					onAgentClick(agent)
				}}
			>
				<div className={styles.agentListContent}>
					<div className={styles.agentListDragHandle}>
						<IconGripVertical size={20} />
					</div>
					<div
						className={styles.agentListIcon}
						style={{
							backgroundColor:
								agent.icon_type === IconType.Image
									? agent.icon?.color
									: getModeBgColor(agent.icon?.color, 0.1),
						}}
					>
						<IconViewComponent
							selectedIcon={agent.icon?.type}
							iconColor={agent.icon?.color}
							iconType={agent.icon_type}
							iconUrl={agent.icon?.url}
							size={28}
						/>
					</div>
					<div className={styles.agentListInfo}>
						<div className={styles.agentListName}>{agent.name}</div>
						<div className={styles.agentListDescription}>{agent.description}</div>
					</div>
					{agent?.type !== AgentType?.buildIn && agent?.type !== AgentType?.Public && (
						<div className={styles.agentListActions}>
							<Button
								type="text"
								size="small"
								icon={<IconEdit size={18} />}
								className={styles.actionButton}
								onClick={(e) => {
									e.stopPropagation()
									onAgentClick(agent)
								}}
							/>
							<Button
								type="text"
								size="small"
								icon={<IconTrash size={18} color="red" />}
								className={styles.actionButton}
								onClick={(e) => onDeleteAgent(agent.id, e)}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// Drop Zone Component
interface DropZoneProps {
	onDrop: (item: DragItem) => void
	targetList: "common" | "all"
	children: React.ReactNode
	className?: string
}

function DropZone({ onDrop, targetList, children, className }: DropZoneProps) {
	const [, drop] = useDrop({
		accept: ItemTypes.AGENT,
		drop: (item: DragItem, monitor) => {
			// Only handle drop if it wasn't handled by a child component
			if (item.sourceList !== targetList && !monitor.didDrop()) {
				onDrop(item)
			}
		},
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
	})

	// const { styles } = useStyles()

	return (
		<div ref={drop} className={`${className}`}>
			{children}
		</div>
	)
}

// Panel Divider Component
function PanelDivider({ icon }: { icon: React.ReactNode }) {
	const { styles } = useStyles()
	return (
		<div className={styles.panelDivider}>
			<div className={styles.dividerLine} />
			<div className={styles.dividerIcon}>{icon}</div>
			<div className={styles.dividerLine} />
		</div>
	)
}

export default function AgentSelector(props: {
	setAgentDesignerVisible: (visible: boolean) => void
	setEditorAgent: (agent: Agent) => void
	setAgentEditorVisible: (visible: boolean) => void
	agentEditorVisible: boolean
	onClose: () => void
}) {
	const { setAgentDesignerVisible, setEditorAgent, setAgentEditorVisible, onClose } = props
	const [searchValue, setSearchValue] = useState("")
	const [commonAgents, setCommonAgents] = useState<Agent[]>([])
	const [allAgents, setAllAgents] = useState<Agent[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const { styles } = useStyles()
	const { token } = antTheme.useToken()
	const { t } = useTranslation("super")

	const fetchAgents = useMemoizedFn(async () => {
		setIsLoading(true)
		try {
			const res = await SuperMagicApi.getAgentsList()
			setCommonAgents(res.frequent || [])
			setAllAgents(res.all || [])
		} catch (error) {
			console.error("获取智能体列表失败:", error)
			magicToast.error(t("agentEditor.agentSelector.getAgentsListError"))
		} finally {
			setIsLoading(false)
		}
	})

	useEffect(() => {
		fetchAgents()
		pubsub.subscribe("super_magic_update_agents", fetchAgents)
		return () => {
			pubsub.unsubscribe("super_magic_update_agents")
		}
	}, [fetchAgents])

	const moveAgent = useMemoizedFn(
		async (
			dragIndex: number,
			hoverIndex: number,
			sourceList: "common" | "all",
			targetList: "common" | "all",
		) => {
			if (sourceList === targetList) {
				// Moving within the same list
				if (sourceList === "common") {
					let newCommonAgents: Agent[] = []
					setCommonAgents((prev) => {
						const newAgents = [...prev]
						const draggedAgent = newAgents[dragIndex]
						newAgents.splice(dragIndex, 1)
						newAgents.splice(hoverIndex, 0, draggedAgent)
						newCommonAgents = newAgents
						return newAgents
					})

					// 保存排序到后端
					try {
						await SuperMagicApi.sortAgents({
							data: {
								frequent: newCommonAgents.map((agent) => agent.id),
								all: allAgents.map((agent) => agent.id),
							},
						})
					} catch (error) {
						console.error("保存智能体排序失败:", error)
						magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
					}
				} else {
					let newAllAgents: Agent[] = []
					setAllAgents((prev) => {
						const newAgents = [...prev]
						const draggedAgent = newAgents[dragIndex]
						newAgents.splice(dragIndex, 1)
						newAgents.splice(hoverIndex, 0, draggedAgent)
						newAllAgents = newAgents
						return newAgents
					})

					// 保存排序到后端
					try {
						await SuperMagicApi.sortAgents({
							data: {
								frequent: commonAgents.map((agent) => agent.id),
								all: newAllAgents.map((agent) => agent.id),
							},
						})
					} catch (error) {
						console.error("保存智能体排序失败:", error)
						magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
					}
				}
			}
		},
	)

	// Handle drop between different lists at specific position
	const handleDropFromOtherList = useMemoizedFn(
		async (item: DragItem, targetIndex: number, targetList: "common" | "all") => {
			if (item.sourceList === "common" && targetList === "all") {
				// 检查是否会导致常用智能体列表为空
				if (commonAgents.length <= 1) {
					magicToast.warning(t("agentEditor.agentSelector.minOneCommonAgent"))
					return
				}

				// Moving from common to all at specific position
				// 直接使用 DragItem 中的 agent 对象，而不是通过索引获取
				const agentToMove = item.agent

				// 添加边界检查
				if (!agentToMove) {
					console.error("找不到要移动的智能体:", item)
					magicToast.error(t("agentEditor.agentSelector.dragFailed"))
					return
				}

				// 验证智能体是否确实存在于常用列表中
				const agentIndex = commonAgents.findIndex((agent) => agent.id === agentToMove.id)
				if (agentIndex === -1) {
					console.error("智能体不存在于常用列表中:", item)
					magicToast.error(t("agentEditor.agentSelector.dragFailed"))
					return
				}

				// 使用同步方式计算新状态，避免竞争条件
				const newCommonAgents = commonAgents.filter((agent) => agent.id !== agentToMove.id)
				const newAllAgents = [...allAgents]
				newAllAgents.splice(targetIndex, 0, agentToMove)

				// 批量更新状态
				setCommonAgents(newCommonAgents)
				setAllAgents(newAllAgents)

				// 保存排序到后端
				try {
					console.log("保存排序数据:", {
						frequent: newCommonAgents.map((agent) => agent.id),
						all: newAllAgents.map((agent) => agent.id),
					})
					await SuperMagicApi.sortAgents({
						data: {
							frequent: newCommonAgents.map((agent) => agent.id),
							all: newAllAgents.map((agent) => agent.id),
						},
					})
				} catch (error) {
					console.error("保存智能体排序失败:", error)
					magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
					// 回滚状态
					setCommonAgents(commonAgents)
					setAllAgents(allAgents)
				}
			} else if (item.sourceList === "all" && targetList === "common") {
				// Moving from all to common at specific position
				// 直接使用 DragItem 中的 agent 对象，而不是通过索引获取
				const agentToMove = item.agent

				// 添加边界检查
				if (!agentToMove) {
					console.error("找不到要移动的智能体:", item)
					magicToast.error(t("agentEditor.agentSelector.dragFailed"))
					return
				}

				// 验证智能体是否确实存在于全部列表中
				const agentIndex = allAgents.findIndex((agent) => agent.id === agentToMove.id)
				if (agentIndex === -1) {
					console.error("智能体不存在于全部列表中:", item)
					magicToast.error(t("agentEditor.agentSelector.dragFailed"))
					return
				}

				// 从全部列表移除并插入到常用列表的指定位置
				const newAllAgents = allAgents.filter((agent) => agent.id !== agentToMove.id)
				const newCommonAgents = [...commonAgents]
				newCommonAgents.splice(targetIndex, 0, agentToMove)

				// 批量更新状态
				setCommonAgents(newCommonAgents)
				setAllAgents(newAllAgents)

				// 保存排序到后端
				try {
					console.log("保存排序数据:", {
						frequent: newCommonAgents.map((agent) => agent.id),
						all: newAllAgents.map((agent) => agent.id),
					})
					await SuperMagicApi.sortAgents({
						data: {
							frequent: newCommonAgents.map((agent) => agent.id),
							all: newAllAgents.map((agent) => agent.id),
						},
					})
				} catch (error) {
					console.error("保存智能体排序失败:", error)
					magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
					// 回滚状态
					setCommonAgents(commonAgents)
					setAllAgents(allAgents)
				}
			}
		},
	)

	// Handle drop to common list
	const handleDropToCommon = useMemoizedFn((item: DragItem, targetIndex: number) => {
		console.log(item, "handleDropToCommonhandleDropToCommon")
		handleDropFromOtherList(item, targetIndex, "common")
	})

	// Handle drop to all list
	const handleDropToAll = useMemoizedFn((item: DragItem, targetIndex: number) => {
		console.log(item, "handleDropToAllhandleDropToAll")
		handleDropFromOtherList(item, targetIndex, "all")
	})

	// Handle drop between different lists (fallback for empty areas)
	const handleDrop = useMemoizedFn(async (item: DragItem) => {
		console.log(item, "handleDrophandleDrop")
		if (item.sourceList === "common") {
			// 检查是否会导致常用智能体列表为空
			if (commonAgents.length <= 1) {
				magicToast.warning(t("agentEditor.agentSelector.minOneCommonAgent"))
				return
			}

			// Moving from common to all (append to end)
			// 直接使用 DragItem 中的 agent 对象，而不是通过索引获取
			const agentToMove = item.agent

			// 添加边界检查
			if (!agentToMove) {
				console.error("找不到要移动的智能体:", item)
				magicToast.error(t("agentEditor.agentSelector.dragFailed"))
				return
			}

			// 验证智能体是否确实存在于常用列表中
			const agentIndex = commonAgents.findIndex((agent) => agent.id === agentToMove.id)
			if (agentIndex === -1) {
				console.error("智能体不存在于常用列表中:", item)
				magicToast.error(t("agentEditor.agentSelector.dragFailed"))
				return
			}

			const newCommonAgents = commonAgents.filter((agent) => agent.id !== agentToMove.id)
			const newAllAgents = [...allAgents, agentToMove]

			setCommonAgents(newCommonAgents)
			setAllAgents(newAllAgents)

			// 保存排序到后端
			try {
				console.log("保存排序数据:", {
					frequent: newCommonAgents.map((agent) => agent.id),
					all: newAllAgents.map((agent) => agent.id),
				})
				await SuperMagicApi.sortAgents({
					data: {
						frequent: newCommonAgents.map((agent) => agent.id),
						all: newAllAgents.map((agent) => agent.id),
					},
				})
			} catch (error) {
				console.error("保存智能体排序失败:", error)
				magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
				// 回滚状态
				setCommonAgents(commonAgents)
				setAllAgents(allAgents)
			}
		} else {
			// Moving from all to common (append to end)
			// 直接使用 DragItem 中的 agent 对象，而不是通过索引获取
			const agentToMove = item.agent

			// 添加边界检查
			if (!agentToMove) {
				console.error("找不到要移动的智能体:", item)
				magicToast.error(t("agentEditor.agentSelector.dragFailed"))
				return
			}

			// 验证智能体是否确实存在于全部列表中
			const agentIndex = allAgents.findIndex((agent) => agent.id === agentToMove.id)
			if (agentIndex === -1) {
				console.error("智能体不存在于全部列表中:", item)
				magicToast.error(t("agentEditor.agentSelector.dragFailed"))
				return
			}

			// 从全部列表移除并添加到常用列表末尾
			const newAllAgents = allAgents.filter((agent) => agent.id !== agentToMove.id)
			const newCommonAgents = [...commonAgents, agentToMove]

			// 批量更新状态
			setCommonAgents(newCommonAgents)
			setAllAgents(newAllAgents)

			// 保存排序到后端
			try {
				console.log("保存排序数据:", {
					frequent: newCommonAgents.map((agent) => agent.id),
					all: newAllAgents.map((agent) => agent.id),
				})
				await SuperMagicApi.sortAgents({
					data: {
						frequent: newCommonAgents.map((agent) => agent.id),
						all: newAllAgents.map((agent) => agent.id),
					},
				})
			} catch (error) {
				console.error("保存智能体排序失败:", error)
				magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
				// 回滚状态
				setCommonAgents(commonAgents)
				setAllAgents(allAgents)
			}
		}
	})

	function handleAgentClick(agent: Agent) {
		if (agent.id === "create-custom") {
			// 打开创建自定义智能体的设计器
			setAgentDesignerVisible(true)
			setEditorAgent({
				id: "",
				icon: { type: "IconAccessibleFilled", color: "#315CEC", url: "" },
				icon_type: IconType.Icon,
				name: "",
				description: "",
				// type: AgentType.Custom,
			})
			setAgentEditorVisible(true)
		} else {
			// 选择已有智能体
			setEditorAgent(agent)
			setAgentEditorVisible(true)
		}
	}

	const handleRemoveFromFavorites = async (agentId: string, e: React.MouseEvent) => {
		e.stopPropagation()

		// 检查是否会导致常用智能体列表为空
		if (commonAgents.length <= 1) {
			magicToast.warning(t("agentEditor.agentSelector.minOneCommonAgent"))
			return
		}

		// 从常用列表中找到要移除的智能体
		const agentToRemove = commonAgents.find((agent) => agent.id === agentId)
		if (!agentToRemove) return

		// 从常用列表中移除
		const newCommonAgents = commonAgents.filter((agent) => agent.id !== agentId)
		setCommonAgents(newCommonAgents)

		// 添加到全部智能体列表（如果不存在的话）
		let newAllAgents = allAgents
		const exists = allAgents.some((agent) => agent.id === agentId)
		if (!exists) {
			newAllAgents = [...allAgents, agentToRemove]
			setAllAgents(newAllAgents)
		}

		// 调用 sortAgents 保存排序，只保存 id
		try {
			await SuperMagicApi.sortAgents({
				data: {
					frequent: newCommonAgents.map((agent) => agent.id),
					all: newAllAgents.map((agent) => agent.id),
				},
			})
		} catch (error) {
			console.error("保存智能体排序失败:", error)
			magicToast.error(t("agentEditor.agentSelector.sortSaveError"))
		}
	}

	const handleDeleteAgent = async (agentId: string, e: React.MouseEvent) => {
		e.stopPropagation()

		Modal.confirm({
			title: t("agentEditor.agentSelector.confirmDelete"),
			content: t("agentEditor.agentSelector.confirmDeleteContent"),
			okText: t("agentEditor.agentSelector.confirmDeleteOk"),
			cancelText: t("agentEditor.agentSelector.cancel"),
			okType: "danger",
			onOk: async () => {
				try {
					await SuperMagicApi.deleteAgent({ agent_id: agentId })
					// 从全部列表中删除智能体
					setAllAgents((prev) => prev.filter((agent) => agent.id !== agentId))
				} catch (error) {
					magicToast.error(t("agentEditor.agentSelector.deleteFailed"))
				}
			},
		})
	}

	// 常用智能体不受搜索影响，始终显示全部
	const filteredCommonAgents = commonAgents

	// 全部智能体根据搜索值进行过滤
	const filteredAllAgents = allAgents.filter(
		(agent) =>
			agent.name.toLowerCase().includes(searchValue.toLowerCase()) ||
			agent.description.toLowerCase().includes(searchValue.toLowerCase()),
	)

	return (
		<DndProvider backend={HTML5Backend}>
			<div className={`${styles.container}`}>
				{/* 顶部标题和搜索 */}
				<div className={`${styles.header}`}>
					<span className={styles.title}>{t("agentEditor.agentSelector.allAgents")}</span>
					<div className={styles.searchWrapper}>
						<Input
							placeholder={t("agentEditor.agentSelector.searchAgent")}
							prefix={<IconSearch size={16} color={token.magicColorUsages.text[3]} />}
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className={`${styles.searchInput}`}
							allowClear
							variant="borderless"
						/>
						<IconX
							size={24}
							onClick={() => {
								setAgentDesignerVisible(false)
								onClose?.()
							}}
							color={token.magicColorUsages.text[1]}
							className={styles.closeIcon}
						/>
					</div>
				</div>

				{/* 内容区域 */}
				{isLoading ? (
					<Spin
						spinning={isLoading}
						style={{
							height: "600px",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
						}}
					></Spin>
				) : (
					<div className={`${styles.content}`}>
						{/* 左侧 - 常用智能体 */}
						<div className={styles.leftPanel}>
							<div className={styles.sectionHeader}>
								<div className={styles.sectionTitle}>
									{t("agentEditor.agentSelector.favoriteAgents")}
								</div>
								<div className={styles.sectionDescription}>
									{t("agentEditor.agentSelector.favoriteAgentsDesc")}
								</div>
							</div>

							<DropZone
								onDrop={handleDrop}
								targetList="common"
								className={`${styles.agentGrid}`}
							>
								{filteredCommonAgents.map((agent, index) => (
									<DraggableCommonAgent
										key={`common-${agent.id}`}
										agent={agent}
										index={index}
										onRemoveFromFavorites={handleRemoveFromFavorites}
										onMoveAgent={moveAgent}
										onDropFromOtherList={handleDropToCommon}
										onAgentClick={handleAgentClick}
									/>
								))}
							</DropZone>
						</div>

						{/* 分隔符 */}
						<PanelDivider icon={<IconArrowLeft />} />

						{/* 右侧 - 全部智能体 */}
						<div className={styles.rightPanel}>
							<div className={styles.sectionHeader}>
								<div className={styles.sectionTitle}>
									{t("agentEditor.agentSelector.allAgents")}
								</div>
								<div className={styles.sectionDescription}>
									{t("agentEditor.agentSelector.allAgentsDesc")}
								</div>
							</div>

							<DropZone
								onDrop={handleDrop}
								targetList="all"
								className={styles.agentList}
							>
								<div
									className={styles.agentListItem}
									onClick={(e) => {
										e.stopPropagation()
										handleAgentClick(createCustomAgent(t))
									}}
								>
									<div className={styles.agentListContent}>
										<div className={styles.addAgentIconContainer}>
											<img
												src={AddAgentIcon}
												className={styles.addAgentIcon}
											/>
										</div>
										<div className={styles.agentListInfo}>
											<div className={styles.addAgentTitle}>
												{createCustomAgent(t).name}
											</div>
											<div className={styles.agentListDescription}>
												{createCustomAgent(t).description}
											</div>
										</div>
									</div>
								</div>

								{/* 其他智能体 */}
								{filteredAllAgents.map((agent, index) => (
									<DraggableAllAgent
										key={`all-${agent.id}`}
										agent={agent}
										index={index}
										onDeleteAgent={handleDeleteAgent}
										onMoveAgent={moveAgent}
										onAgentClick={handleAgentClick}
										onDropFromOtherList={handleDropToAll}
									/>
								))}
							</DropZone>
						</div>
					</div>
				)}
			</div>
		</DndProvider>
	)
}
