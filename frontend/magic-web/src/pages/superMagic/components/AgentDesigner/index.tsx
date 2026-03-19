import AgentSelector from "../AgentSelector"
import AgentEditor from "../AgentEditor"
import { useState, useRef, useEffect } from "react"
import { AgentEditorRef } from "../AgentEditor/types"
import AgentConfigPanel, {
	AgentConfigPanelRef,
} from "@/pages/superMagic/components/AgentConfigPanel"
import { useLatest, useMemoizedFn, useUpdateEffect } from "ahooks"
import { Modal, Button, Flex, Popover } from "antd"
import { toolItem } from "@/pages/superMagic/components/AgentConfigPanel/components/types"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import {
	encodeCrewAgentPrompt,
	resolveCrewAgentPromptText,
} from "@/services/crew/agent-prompt"
import pubsub from "@/utils/pubsub"
import MagicDropdown from "@/components/base/MagicDropdown"
import AIOptimizationSvg from "@/pages/superMagic/assets/svg/tabler-icon-sparkles.svg"
import {
	IconX,
	IconCaretDownFilled,
	IconLabel,
	IconTextCaption,
	IconRobotFace,
	IconBlockquote,
	IconEye,
} from "@tabler/icons-react"
import { SuperMagicApi } from "@/apis"
import { IconType } from "../AgentSelector/types"
import magicToast from "@/components/base/MagicToaster/utils"
import VisibleRangeSelector from "@/components/business/VisibleRangeSelector"
import { VisibleRangeType, Bot } from "@/types/bot"
import { TreeNode, NodeType } from "@dtyq/user-selector"
import { userStore } from "@/models/user"

// 定义 Agent 数据类型
interface AgentData {
	id?: string
	name: string
	description: string
	icon?: { type: string; color: string; url: string }
	icon_type: IconType
	tools: toolItem[]
	prompt: string
	type?: "general" | "chat" | "data_analysis" | "ppt" | "report" | "custom" | "summary"
	isCustom?: boolean
	visibility_config?: Bot.VisibilityConfig
}

export default function AgentDesigner(props: {
	agentDesignerVisible: boolean
	setAgentDesignerVisible: (visible: boolean) => void
	onClose: () => void
}) {
	const { agentDesignerVisible, setAgentDesignerVisible, onClose } = props
	const [editorAgent, setEditorAgent] = useState<AgentData>({
		name: "",
		description: "",
		icon_type: IconType.Icon,
		tools: [],
		prompt: "",
	})
	const [agentEditorVisible, setAgentEditorVisible] = useState(false)
	const agentEditorRef = useRef<AgentEditorRef>(null)
	const agentConfigPanelRef = useRef<AgentConfigPanelRef>(null)
	const { t } = useTranslation("super")
	const { t: tInterface } = useTranslation("interface")
	const { styles } = useStyles()
	const [loading, setLoading] = useState(true)
	const [saveLoading, setSaveLoading] = useState(false)
	const [aiDropdownOpen, setAiDropdownOpen] = useState(false)
	const [visibleRangeOpen, setVisibleRangeOpen] = useState(false)
	const [selected, setSelected] = useState<TreeNode[]>([])
	const [isAddingMember, setIsAddingMember] = useState(false) // 标记是否正在添加成员
	const [visibilityType, setVisibilityType] = useState<VisibleRangeType>(VisibleRangeType.Unset)
	const visibilityTypeRef = useLatest<VisibleRangeType>(visibilityType)
	const { isAdmin, isPersonalOrganization } = userStore.user

	// 回显逻辑：当 editorAgent 的 id 变化时，调用 API 获取完整数据并回显
	useEffect(() => {
		if (!editorAgent.id) {
			setSelected([])
			return
		}

		// 调用 API 获取完整 agent 数据
		const fetchAgentDetail = async () => {
			try {
				const agentDetail = await SuperMagicApi.getAgentDetail({
					agent_id: editorAgent.id as string,
				})

				if (agentDetail.visibility_config) {
					const { users = [], departments = [] } = agentDetail.visibility_config

					const selectedNodes: TreeNode[] = [
						...users.map(
							(user: {
								id: string
								nickname: string
								name: string
								avatar_url: string
								avatar: string
							}) =>
								({
									id: user.id,
									name: user.nickname || user.name || "",
									nickname: user.nickname || user.name || "",
									avatar_url: user.avatar_url || user.avatar || "",
									dataType: NodeType.User,
								}) as TreeNode,
						),
						...departments.map(
							(dept: { id: string; name: string }) =>
								({
									id: dept.id,
									name: dept.name || "",
									dataType: NodeType.Department,
								}) as TreeNode,
						),
					]
					setSelected(selectedNodes)

					setVisibilityType(
						agentDetail.visibility_config?.visibility_type || VisibleRangeType.Unset,
					)

					// 同步更新 editorAgent 的 visibility_config
					setEditorAgent((prevAgent) => ({
						...prevAgent,
						visibility_config: agentDetail.visibility_config,
					}))
				} else {
					setSelected([])
					// 清空 visibility_config
					setEditorAgent((prevAgent) => ({
						...prevAgent,
						visibility_config: undefined,
					}))
					setVisibilityType(VisibleRangeType.Unset)
				}
			} catch (error) {
				console.error("获取 agent 详情失败:", error)
				setSelected([])
			}
		}

		fetchAgentDetail()
	}, [editorAgent.id])

	// 通用的字段更新方法
	const updateAgentField = useMemoizedFn(
		<K extends keyof AgentData>(field: K, value: AgentData[K]) => {
			setEditorAgent((prevAgent) => ({
				...prevAgent,
				[field]: value,
			}))
		},
	)

	// 监听 selected 变化，同步更新 editorAgent 的 visibility_config
	useEffect(() => {
		// 如果是新建 agent（没有 id）且 selected 为空，不设置 visibility_config
		if (!editorAgent.id && selected.length === 0) {
			setEditorAgent((prevAgent) => ({
				...prevAgent,
				visibility_config: undefined,
			}))
			return
		}

		const users = selected
			.filter((item) => item.dataType === NodeType.User)
			.map((item) => ({
				id: item.id,
				name: item.nickname,
				avatar: item.avatar_url,
				avatar_url: item.avatar_url,
				nickname: item.nickname,
			}))

		const departments = selected
			.filter((item) => item.dataType === NodeType.Department)
			.map((item) => ({
				id: item.id,
				name: item.name,
			}))

		setEditorAgent((prevAgent) => ({
			...prevAgent,
			visibility_config: {
				...(prevAgent.visibility_config as Bot.VisibilityConfig),
				users,
				departments,
				visibility_type: visibilityTypeRef.current as VisibleRangeType,
			},
		}))
	}, [selected, editorAgent.id])

	// 工具相关的特殊处理方法
	const handleToolAdd = useMemoizedFn((tool: any) => {
		setEditorAgent((prevAgent) => {
			const tools = prevAgent.tools || []
			return {
				...prevAgent,
				tools: [...tools, tool],
			}
		})
	})

	const handleToolRemove = useMemoizedFn((toolId: string) => {
		setEditorAgent((prevAgent) => {
			const tools = prevAgent.tools || []
			return {
				...prevAgent,
				tools: tools.filter((tool) => tool.code !== toolId),
			}
		})
	})

	const handleSaveAgent = useMemoizedFn(async () => {
		// 防止重复提交
		if (saveLoading) return

		setSaveLoading(true)

		try {
			// 从 AgentConfigPanel 获取表单数据
			const formData = agentConfigPanelRef.current?.getFormData()
			const res = await agentEditorRef.current?.getData()

			// 数据校验
			if (!formData?.name?.trim()) {
				magicToast.error(t("agentEditor.nameRequired"))
				return
			}

			if (!editorAgent.icon?.type?.trim()) {
				magicToast.error(t("agentEditor.iconRequired"))
				return
			}

			if (res?.length === 0) {
				magicToast.error(t("agentEditor.promptRequired"))
				return
			}

			const data = {
				...editorAgent,
				name: formData.name.trim(),
				description: formData.description.trim(),
				prompt_shadow: encodeCrewAgentPrompt(res ?? ""),
			}

			// 只有当 visibility_config 存在时才包含（避免为新建 agent 传递 undefined）
			if (editorAgent.visibility_config !== undefined) {
				data.visibility_config = editorAgent.visibility_config
				data.visibility_config.visibility_type =
					visibilityTypeRef.current as VisibleRangeType
			}

			await SuperMagicApi.editAgent({ data })
			setAgentEditorVisible(false)
			magicToast.success(t("agentEditor.saveSuccess"))
			pubsub.publish("super_magic_update_agents")
		} catch (error) {
			console.error(error, "error")
		} finally {
			setSaveLoading(false)
		}
	})

	// AI优化选项配置
	const aiOptimizationOptions = [
		{
			key: "optimize_name_description",
			icon: <IconLabel size={20} stroke={1.5} />,
			title: t("agentEditor.aiOptimization.generateNameDescription"),
			description: t("agentEditor.aiOptimization.generateNameDescriptionDesc"),
			message: t("agentEditor.aiOptimization.generatingNameDescription"),
		},
		{
			key: "optimize_content",
			icon: <IconTextCaption size={20} stroke={1.5} />,
			title: t("agentEditor.aiOptimization.generateContent"),
			description: t("agentEditor.aiOptimization.generateContentDesc"),
			message: t("agentEditor.aiOptimization.generatingContent"),
		},
		{
			key: "optimize_name",
			icon: <IconRobotFace size={20} stroke={1.5} />,
			title: t("agentEditor.aiOptimization.optimizeName"),
			description: t("agentEditor.aiOptimization.optimizeNameDesc"),
			message: t("agentEditor.aiOptimization.optimizingName"),
		},
		{
			key: "optimize_description",
			icon: <IconBlockquote size={20} stroke={1.5} />,
			title: t("agentEditor.aiOptimization.optimizeDescription"),
			description: t("agentEditor.aiOptimization.optimizeDescriptionDesc"),
			message: t("agentEditor.aiOptimization.optimizingDescription"),
		},
	]

	// AI优化处理函数
	const handleAIOptimization = useMemoizedFn(async (optionKey: string) => {
		setAiDropdownOpen(false)
		const option = aiOptimizationOptions.find((opt) => opt.key === optionKey)
		if (option) {
			magicToast.info({
				content: option.message,
				duration: 0,
			})
			const formData = agentConfigPanelRef.current?.getFormData()
			const res = await agentEditorRef.current?.getData()
			setLoading(true)
			SuperMagicApi.AIOptimizationAgent({
				data: {
					optimization_type: optionKey,
					agent: {
						...editorAgent,
						name: formData?.name?.trim(),
						description: formData?.description?.trim(),
						prompt_shadow: encodeCrewAgentPrompt(res ?? ""),
					},
				},
			})
				.then((res) => {
					magicToast.destroy()
					magicToast.success(t("agentEditor.aiOptimization.optimizeSuccess"))
					setEditorAgent((pre) => {
						return {
							...pre,
							name: res.agent?.name,
							description: res.agent?.description,
							tools: res.agent?.tools,
						}
					})
					res?.agent?.name && agentConfigPanelRef.current?.setName(res?.agent?.name)
					res?.agent?.description &&
						agentConfigPanelRef.current?.setDescription(res?.agent?.description)
					const prompt = resolveCrewAgentPromptText(res?.agent?.prompt)
					if (prompt) agentEditorRef.current?.setData(prompt)
					setLoading(false)
				})
				.catch((error) => {
					console.error(error, "error")
					setLoading(false)
				})
		}
	})

	useUpdateEffect(() => {
		if (!agentEditorVisible) {
			setEditorAgent({
				name: "",
				description: "",
				icon_type: IconType.Icon,
				tools: [],
				prompt: "",
			})
			// 同时重置 selected 状态
			setSelected([])
		}
	}, [agentEditorVisible])

	return (
		<>
			<Modal
				open={agentDesignerVisible}
				onCancel={() => {
					setAgentDesignerVisible(false)
					onClose?.()
				}}
				footer={null}
				width={1000}
				height={700}
				centered
				destroyOnHidden
				closable={false}
			>
				<AgentSelector
					setAgentDesignerVisible={setAgentDesignerVisible}
					setEditorAgent={setEditorAgent as any}
					setAgentEditorVisible={setAgentEditorVisible}
					agentEditorVisible={agentEditorVisible}
					onClose={onClose}
				/>
			</Modal>
			<Modal
				width={1000}
				height={700}
				open={agentEditorVisible}
				onCancel={() => {
					setAgentEditorVisible(false)
					setLoading(true)
				}}
				destroyOnHidden
				title={null}
				maskClosable={false}
				centered
				footer={
					<div className={styles.modalFooter}>
						<Button
							className={styles.cancelButton}
							onClick={() => {
								setAgentEditorVisible(false)
								setLoading(true)
							}}
							disabled={saveLoading}
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="primary"
							className={styles.confirmButton}
							onClick={handleSaveAgent}
							loading={saveLoading}
							disabled={loading || saveLoading}
						>
							{t("common.confirm")}
						</Button>
					</div>
				}
				closable={false}
			>
				<div className={styles.title}>
					<span>{t("agentEditor.title")}</span>
					<div className={styles.titleRight}>
						{!isPersonalOrganization && isAdmin && (
							<Popover
								content={
									<div
										className={styles.visibleRangeContent}
										onClick={(e) => {
											e.stopPropagation()
										}}
									>
										<VisibleRangeSelector
											selected={selected}
											setSelected={setSelected}
											type={visibilityType}
											onAddMemberStart={() => setIsAddingMember(true)}
											onAddMemberEnd={() => setIsAddingMember(false)}
											title={tInterface("explore.form.visibleRange")}
											description={tInterface(
												"explore.form.agentVisibleRangeDesc",
											)}
											onTypeChange={(type) => setVisibilityType(type)}
										/>
									</div>
								}
								title={null}
								trigger="click"
								open={visibleRangeOpen}
								onOpenChange={(open) => {
									// 只在添加成员期间阻止 Popover 关闭
									if (!open && isAddingMember) {
										return
									}
									setVisibleRangeOpen(open)
								}}
								placement="bottomRight"
								overlayClassName={styles.visibleRangePopover}
								destroyTooltipOnHide={false}
								autoAdjustOverflow={false}
							>
								<Flex
									align="center"
									justify="center"
									className={styles.visibleRangeButton}
									onClick={() => setVisibleRangeOpen(true)}
								>
									<IconEye size={16} stroke={1.5} />
									<span>{tInterface("explore.form.setVisibleRange")}</span>
								</Flex>
							</Popover>
						)}
						<MagicDropdown
							popupRender={() => {
								return (
									<div className={styles.dropdownContent}>
										{aiOptimizationOptions.map((option) => (
											<div
												key={option.key}
												className={styles.dropdownItem}
												onClick={() => handleAIOptimization(option.key)}
											>
												{option.icon}
												{/* <div className={styles.itemIcon}>{option.icon}</div> */}
												<div className={styles.itemContent}>
													<div className={styles.itemTitle}>
														{option.title}
													</div>
													<div className={styles.itemDesc}>
														{option.description}
													</div>
												</div>
											</div>
										))}
									</div>
								)
							}}
							placement="bottomRight"
							trigger={["click"]}
							open={aiDropdownOpen}
							onOpenChange={setAiDropdownOpen}
							disabled={loading}
						>
							<Flex
								align="center"
								justify="center"
								className={styles.AIeditContainer}
							>
								<Flex
									align="center"
									justify="center"
									className={styles.AIeditButtons}
								>
									<img src={AIOptimizationSvg} alt="" />
									<span className={styles.aiEditText}>
										{t("agentEditor.Optimize")}
									</span>
									<IconCaretDownFilled
										size={12}
										stroke={1.5}
										color="rgba(28, 29, 35, 0.8)"
									/>
								</Flex>
							</Flex>
						</MagicDropdown>
						<IconX
							size={20}
							stroke={1.5}
							onClick={() => {
								setAgentEditorVisible(false)
								setLoading(true)
							}}
							style={{ cursor: "pointer" }}
						/>
					</div>
				</div>

				<AgentConfigPanel
					ref={agentConfigPanelRef}
					agent={editorAgent}
					tools={editorAgent.tools}
					onAvatarChange={(icon, icon_type) => {
						updateAgentField("icon", icon)
						updateAgentField("icon_type", icon_type)
					}}
					onToolAdd={handleToolAdd}
					onToolRemove={handleToolRemove}
					setLoading={setLoading}
					loading={loading}
				/>
				<AgentEditor
					agent={editorAgent}
					ref={agentEditorRef}
					setEditorAgent={setEditorAgent}
					setLoading={setLoading}
					loading={loading}
				/>
			</Modal>
		</>
	)
}
