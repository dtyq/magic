import { useState, useEffect } from "react"
import { Tabs, Segmented, Collapse, Modal } from "antd"
import { IconTools, IconCheck, IconChevronRight, IconChevronDown, IconX } from "@tabler/icons-react"
import { ToolSelectModalProps, ToolCategory, toolItem } from "./types"
import { AgentType } from "@/pages/superMagic/components/AgentSelector/types"
import { useMemoizedFn, useMount } from "ahooks"
import CustomIcon from "@/pages/superMagic/components/AgentConfigPanel/assets/svg/customIcon.svg"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import { SuperMagicApi } from "@/apis"

export default function ToolSelectModal({
	visible,
	selectedTools,
	onCancel,
	onConfirm,
}: ToolSelectModalProps) {
	const { styles } = useStyles()
	const [activeTab, setActiveTab] = useState("builtIn")
	const [activeBuiltInCategory, setActiveBuiltInCategory] = useState("")
	const [builtInTools, setBuiltInTools] = useState<ToolCategory[]>([])
	const [customTools, setCustomTools] = useState<ToolCategory[]>([])
	const [dataLoaded, setDataLoaded] = useState(false)
	const { t } = useTranslation("super")

	useMount(() => {
		Promise.all([
			SuperMagicApi.getBuiltInTools(),
			SuperMagicApi.getAvailableCustomTools({ with_builtin: false }),
		]).then(([builtInRes, customRes]) => {
			setBuiltInTools(builtInRes)
			setCustomTools(customRes.list)
			// 第一次挂载时，如果官方工具有数据，默认选中第一个tab
			if (builtInRes && builtInRes.length > 0) {
				setActiveBuiltInCategory(builtInRes[0].name)
			}
			setDataLoaded(true)
		})
	})

	// 当数据加载完成且选中工具为空时，默认选中所有required工具
	useEffect(() => {
		if (!dataLoaded || selectedTools.length > 0) return

		const requiredTools: toolItem[] = []

		// 收集所有required为true的官方工具
		builtInTools.forEach((category) => {
			category.tools.forEach((tool) => {
				if (tool.required) {
					requiredTools.push({ ...tool, type: AgentType.buildIn })
				}
			})
		})

		// 收集所有required为true的自定义工具
		customTools.forEach((category) => {
			category.tools.forEach((tool) => {
				if (tool.required) {
					requiredTools.push({ ...tool, type: AgentType.Custom })
				}
			})
		})

		// 如果有required工具，默认选中它们
		if (requiredTools.length > 0) {
			onConfirm(requiredTools)
		}
	}, [dataLoaded, selectedTools.length, builtInTools, customTools, onConfirm])

	// 检查工具是否已被添加
	const isToolAdded = useMemoizedFn((toolId: string) => {
		return selectedTools.some((tool) => tool.code === toolId)
	})
	// 切换工具选中状态
	const handleToggleTool = useMemoizedFn((tool: toolItem) => {
		if (isToolAdded(tool.code)) {
			// 移除工具
			const updatedTools = selectedTools.filter((t) => t.code !== tool.code)
			onConfirm(updatedTools)
		} else {
			// 添加工具
			onConfirm([...selectedTools, tool])
		}
	})

	// 根据当前标签页判断工具类型并调用handleToggleTool
	const handleToggleToolWithType = useMemoizedFn((tool: toolItem) => {
		// 判断当前是官方工具还是自定义工具
		const toolType = activeTab === "builtIn" ? AgentType.buildIn : AgentType.Custom
		const toolWithType = { ...tool, type: toolType }

		// 检查是否为必需工具，如果是必需工具且已选中，则禁止取消选中
		if (tool.required && isToolAdded(tool.code)) {
			return
		}
		handleToggleTool(toolWithType)
	})

	// 渲染工具项
	const renderToolItem = useMemoizedFn((tool: toolItem) => {
		const isAdded = isToolAdded(tool.code)
		const isRequired = tool.required
		const isDisabledFromRemoving = isRequired && isAdded

		return (
			<div
				key={tool.code}
				className={styles.toolItem}
				onClick={() => handleToggleToolWithType(tool)}
				style={{
					cursor: isDisabledFromRemoving ? "not-allowed" : "pointer",
					opacity: isDisabledFromRemoving ? 0.7 : 1,
				}}
			>
				<div className={`${styles.toolIcon} ${isAdded ? styles.addedButtonIcon : ""}`}>
					<IconTools stroke={1.5} size={24} style={{ color: isAdded ? "#315CEC" : "" }} />
				</div>
				<div className={styles.toolInfo}>
					<div className={styles.toolName}>
						{tool.name}
						{isRequired && <span style={{ color: "red", marginLeft: 4 }}>*</span>}
					</div>
					<div className={styles.toolCode}>{tool.code}</div>
					<div className={styles.toolDescription}>{tool.description}</div>
				</div>
				<span className={`${styles.addButton} ${isAdded ? styles.addedButtonIcon : ""}`}>
					{isAdded ? (
						<IconCheck
							stroke={1.5}
							size={20}
							style={{ color: isAdded ? "#315CEC" : "" }}
						/>
					) : (
						<span className={styles.addButtonText}>
							{t("agentEditor.toolSelectModal.addTool")}
						</span>
					)}
				</span>
			</div>
		)
	})

	// 渲染单个分类的工具网格
	const renderCategoryTools = useMemoizedFn((category: ToolCategory) => {
		if (category.tools.length === 0) {
			return (
				<div className={styles.emptyCategory}>
					{t("agentEditor.toolSelectModal.noAvailableTools")}
				</div>
			)
		}

		return <div className={styles.toolGrid}>{category.tools.map(renderToolItem)}</div>
	})

	// 官方工具子标签页项
	const officialCategoryTabs = builtInTools.map((category: ToolCategory) => ({
		key: category.name,
		label: (
			<span>
				<span style={{ marginRight: 6 }}>{category.icon}</span>
				{category.name}
			</span>
		),
		children: <div className={styles.nestedTabContent}>{renderCategoryTools(category)}</div>,
	}))

	// 官方工具标签页内容（嵌套子标签页）
	const officialToolsContent = (
		<Tabs
			activeKey={activeBuiltInCategory}
			onChange={setActiveBuiltInCategory}
			items={officialCategoryTabs}
			size="small"
		/>
	)
	// 自定义工具标签页内容
	const customToolsContent = (
		<div className={styles.collapseContainer}>
			{customTools.length === 0 ? (
				<div className={styles.emptyCategory}>
					{t("agentEditor.toolSelectModal.noAvailableTools")}
				</div>
			) : (
				<Collapse
					size="small"
					expandIcon={({ isActive }) =>
						isActive ? (
							<IconChevronDown
								stroke={1.5}
								size={16}
								style={{ color: "rgba(28, 29, 35, 0.6)" }}
							/>
						) : (
							<IconChevronRight
								size={16}
								style={{ color: "rgba(28, 29, 35, 0.6)" }}
								stroke={1.5}
							/>
						)
					}
					bordered={false}
					items={customTools.map((category: ToolCategory) => ({
						key: category.id,
						label: (
							<div className={styles.collapseHeader}>
								<img src={CustomIcon} className={styles.collapseIcon} />
								<span className={styles.collapseName}>{category.name}</span>
							</div>
						),
						children: (
							<div className={styles.toolGrid}>
								{category.tools.length > 0 ? (
									category.tools.map(renderToolItem)
								) : (
									<div className={styles.emptyCategory}>
										{t("agentEditor.toolSelectModal.noAvailableTools")}
									</div>
								)}
							</div>
						),
					}))}
				/>
			)}
		</div>
	)

	const segmentedOptions = [
		{
			label: t("agentEditor.toolSelectModal.officialTools"),
			value: "builtIn",
		},
		{
			label: t("agentEditor.toolSelectModal.customTools"),
			value: "custom",
		},
	]

	// 根据当前选中的类型渲染内容
	const renderContent = () => {
		if (activeTab === "builtIn") {
			return officialToolsContent
		}
		return customToolsContent
	}

	return (
		<Modal
			// title={t("agentEditor.toolSelectModal.title")}
			title={null}
			open={visible}
			onCancel={onCancel}
			footer={null}
			width={800}
			className={styles.modal}
			closable={false}
			centered
		>
			<div className={styles.modalTitle}>
				<span>{t("agentEditor.toolSelectModal.title")}</span>
				<IconX size={24} stroke={1.5} onClick={onCancel} style={{ cursor: "pointer" }} />
			</div>
			<Segmented
				options={segmentedOptions}
				value={activeTab}
				onChange={setActiveTab}
				size="middle"
				style={{ marginTop: 20 }}
			/>
			<div className={styles.contentContainer}>{renderContent()}</div>
		</Modal>
	)
}
