import { useState, useRef, forwardRef, useImperativeHandle } from "react"
import { Input, Button, Popover } from "antd"
import { IMCPItem } from "@/components/Agent/MCP/types"
import IconSelectContent, {
	Selection,
} from "@/pages/superMagic/components/IconSelectContent/index"
import ToolSelectModal from "./components/ToolSelectModal"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import SelectedToolIcon from "./assets/svg/selectedToolIcon.svg"
import { toolItem } from "./components/types"
import { IconPlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { getModeBgColor } from "../TopicMode/modeColor"
import { IconType } from "../AgentSelector/types"

interface AgentConfigPanelProps {
	/** 智能体数据 */
	agent?: any
	/** 可用工具列表 */
	tools?: any
	/** 图标变化回调 */
	onAvatarChange?: (
		avatar: { type: string; color: string; url: string },
		icon_type: IconType,
	) => void
	/** 工具添加回调 */
	onToolAdd?: (tool: IMCPItem) => void
	/** 工具删除回调 */
	onToolRemove?: (toolId: string) => void
	setLoading: (loading: boolean) => void
	loading: boolean
}

export interface AgentConfigPanelRef {
	/** 获取智能体名称 */
	getName: () => string
	/** 获取智能体描述 */
	getDescription: () => string
	/** 获取表单数据 */
	getFormData: () => { name: string; description: string }
	/** 设置智能体名称 */
	setName: (name: string) => void
	/** 设置智能体描述 */
	setDescription: (description: string) => void
}

const AgentConfigPanel = forwardRef<AgentConfigPanelRef, AgentConfigPanelProps>(
	(
		{ agent = {}, tools = [], onAvatarChange, onToolAdd, onToolRemove, setLoading, loading },
		ref,
	) => {
		const { styles } = useStyles()
		const [isToolModalVisible, setIsToolModalVisible] = useState(false)

		const { t } = useTranslation("super")
		// 用于获取表单字段值的 ref
		const nameInputRef = useRef<any>(null)
		const descriptionInputRef = useRef<any>(null)

		// 暴露获取表单数据的方法
		useImperativeHandle(
			ref,
			() => ({
				getName: () => nameInputRef.current?.input?.value || "",
				getDescription: () => descriptionInputRef.current?.input?.value || "",
				getFormData: () => ({
					name: nameInputRef.current?.input?.value || "",
					description: descriptionInputRef.current?.input?.value || "",
				}),
				setName: (name: string) => {
					if (nameInputRef.current) {
						// 使用 React 的方式触发 input 事件来更新值
						const input = nameInputRef.current.input
						if (input) {
							const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
								window.HTMLInputElement.prototype,
								"value",
							)?.set
							if (nativeInputValueSetter) {
								nativeInputValueSetter.call(input, name)
								const event = new Event("input", { bubbles: true })
								input.dispatchEvent(event)
							}
						}
					}
				},
				setDescription: (description: string) => {
					if (descriptionInputRef.current) {
						// 使用 React 的方式触发 input 事件来更新值
						const input = descriptionInputRef.current.input
						if (input) {
							const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
								window.HTMLInputElement.prototype,
								"value",
							)?.set
							if (nativeInputValueSetter) {
								nativeInputValueSetter.call(input, description)
								const event = new Event("input", { bubbles: true })
								input.dispatchEvent(event)
							}
						}
					}
				},
			}),
			[],
		)

		const handleToolAddClick = useMemoizedFn(() => {
			setIsToolModalVisible(true)
		})

		const handleToolSelect = useMemoizedFn(async (selectedTools: toolItem[]) => {
			// 处理新添加的工具
			selectedTools.forEach((tool: any) => {
				if (!tools.some((t: any) => t.code === tool.code)) {
					onToolAdd?.(tool)
				}
			})

			// 处理被移除的工具
			tools.forEach((tool: any) => {
				if (!selectedTools.some((selectedTool) => selectedTool.code === tool.code)) {
					onToolRemove?.(tool.code)
				}
			})
		})

		return (
			<div className={styles.container}>
				{/* 头部区域 - 图标和基本信息 */}
				<Popover
					content={
						<IconSelectContent
							selectedIcon={agent.icon}
							iconType={agent.icon_type}
							onSelect={(selection: Selection) =>
								onAvatarChange?.(
									{
										type: selection.type,
										color: selection.color,
										url: selection.url,
									},
									selection.icon_type,
								)
							}
						/>
					}
					trigger="click"
					arrow={false}
					placement="bottomLeft"
					classNames={{ root: styles.popover }}
				>
					<div className={styles.changeIconContainer}>
						<div
							style={{
								backgroundColor:
									agent.icon_type === IconType.Image
										? agent.icon?.color
										: getModeBgColor(agent.icon?.color),
							}}
							className={styles.iconWrapper}
						>
							<IconComponent
								selectedIcon={agent.icon?.type || "IconAdOff"}
								iconType={agent.icon_type}
								iconUrl={agent.icon?.url}
								size={30}
								iconColor={agent.icon?.color}
							/>
						</div>
						<div className={styles.changeIconText}>
							{t("agentEditor.configPanel.changeIcon")}
						</div>
					</div>
				</Popover>
				<Input
					ref={nameInputRef}
					placeholder={t("agentEditor.configPanel.agentNamePlaceholder")}
					defaultValue={agent.name}
					// onChange={handleNameChange}
					variant="borderless"
					maxLength={20}
					className={styles.nameInput}
					disabled={loading}
				/>
				{/* 智能体描述 */}
				<Input
					ref={descriptionInputRef}
					placeholder={t("agentEditor.configPanel.agentDescriptionPlaceholder")}
					defaultValue={agent.description}
					// onChange={handleDescriptionChange}
					maxLength={200}
					variant="borderless"
					className={styles.descriptionInput}
					disabled={loading}
				/>

				{/* <Spin spinning={loading}> */}
				{/* 可用工具 */}
				<div className={styles.toolsSection}>
					<div className={styles.toolsHeader}>
						<label className={styles.label}>
							{t("agentEditor.configPanel.availableTools")}
						</label>
					</div>
					<div className={styles.toolsList}>
						{tools.map((tool: any) => (
							<div key={tool.code} className={styles.toolItem}>
								<img src={SelectedToolIcon} className={styles.toolIcon} />
								<span>{tool.name}</span>
								{/* <CloseOutlined
								className={styles.toolRemoveBtn}
								onClick={() => handleToolRemove(tool.code)}
							/> */}
							</div>
						))}
						<Button
							type="text"
							className={styles.addToolButton}
							onClick={handleToolAddClick}
							disabled={loading}
						>
							<IconPlus size={14} stroke={1.5} />
							{t("agentEditor.configPanel.addTool")}
						</Button>
					</div>
				</div>
				{/* </Spin> */}

				{/* 工具选择弹窗 */}
				<ToolSelectModal
					visible={isToolModalVisible}
					selectedTools={tools}
					onCancel={() => setIsToolModalVisible(false)}
					onConfirm={handleToolSelect}
				/>
			</div>
		)
	},
)

export default AgentConfigPanel
