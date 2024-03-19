import { Divider, Flex, Button } from "antd"
import {
	IconAlertCircleFilled,
	IconChevronRight,
	IconTools,
	IconPlus,
	IconPackage,
} from "@tabler/icons-react"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import { useStyles } from "./styles"
import { useState } from "react"
import type { UseableToolSet } from "@/opensource/types/flow"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import defaultToolAvatar from "@/opensource/assets/logos/tool-avatar.png"
import { useTranslation } from "react-i18next"
import { openCreateToolModal } from "../../../business/CreateToolModal/openCreateToolModal"
import { hasEditRight } from "@/opensource/pages/flow/components/AuthControlButton/types"

interface CollapseItemProps {
	item: UseableToolSet.Item
	usableCache: Set<string>
	onToolAdd?: (tool: UseableToolSet.UsableTool, toolSetId: string) => void
	onToolsUpdate?: (toolsetId: string, tools: UseableToolSet.UsableTool[]) => void
}

export default function CollapseItem(props: CollapseItemProps) {
	const { item, usableCache, onToolAdd, onToolsUpdate } = props

	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")

	const [open, setOpen] = useState(true)

	// 处理新增工具
	const handleAddTool = () => {
		if (!item?.id) return

		openCreateToolModal({
			toolsetId: item.id,
			onSuccess: (toolData) => {
				// 工具发布后，更新当前工具集的工具列表
				// 不自动添加到任何地方，只更新 item.tools 供用户选择
				if (onToolsUpdate && item.tools && toolData.id) {
					// 创建基础工具对象，复杂的类型配置在实际使用时会重新获取
					const newTool = {
						code: toolData.id,
						name: toolData.name || "",
						description: toolData.description || "",
						input: {} as any,
						output: {} as any,
						custom_system_input: {} as any,
					} as UseableToolSet.UsableTool
					onToolsUpdate(item.id, [newTool, ...item.tools])
				}
			},
			showJustAddButton: false,
			showAddAndNextButton: true,
		})
	}

	return (
		<div
			className={cx(styles.item, {
				[styles.itemActive]: open,
			})}
		>
			<div className={styles.itemWrapper} onClick={() => setOpen((v) => !v)}>
				<div className={styles.itemIcon}>
					<MagicAvatar
						style={{ borderRadius: 8 }}
						src={item?.icon || defaultToolAvatar}
						size={50}
					>
						{item?.name}
					</MagicAvatar>
				</div>
				<div className={styles.itemContainer}>
					<div className={styles.itemNav}>
						<span className={cx(styles.itemName, styles.font)}>{item?.name}</span>
						<Flex align="center" gap={4}>
							<div className={styles.itemTag}>
								<IconTools size={14} color={colorUsages.primary.default} />
								<span>
									{t("common.tool.card.toolsCount", {
										count: item?.tools?.length || 0,
									})}
								</span>
							</div>
							<div className={styles.itemTag}>
								<IconAlertCircleFilled
									size={14}
									color={colorUsages.warning.default}
								/>
								<span>{t("common.tool.card.noQuote")}</span>
							</div>
						</Flex>
						<div
							className={cx(styles.itemButton, {
								[styles.itemButtonActive]: open,
							})}
						>
							<IconChevronRight size={20} />
						</div>
					</div>
					<div className={cx(styles.itemDesc, styles.font)}>{item?.description}</div>
				</div>
			</div>
			{item?.creator_info?.name && (
				<div className={styles.itemFooter}>
					<span className={cx(styles.tag, styles.primary)}>
						{item?.creator_info?.name}
					</span>
					<Divider type="vertical" />
					<span className={styles.tag}>
						{t("common.tool.card.createAt")} {item?.created_at}0
					</span>
				</div>
			)}
			{open && (
				<>
					<Divider className={styles.divider} />
					<div className={styles.subWrapper}>
						<div className={styles.subHeader}>
							{t("common.tool.card.groupTitle", { count: item?.tools?.length || 0 })}
						</div>

						{/* 新增工具按钮 - 需要编辑权限 */}
						{hasEditRight(item.user_operation || 0) && (
							<Button
								className={cx(styles.secondaryButton, styles.addToolButton)}
								icon={<IconPackage size={20} />}
								onClick={handleAddTool}
							>
								{t("common.tool.addTool")}
							</Button>
						)}
						<MagicScrollBar className={styles.subScroll} autoHide={false}>
							{item?.tools?.map((tool) => (
								<div className={styles.subItem} key={tool?.code}>
									<div className={styles.subItemNav}>
										<div className={styles.subItemName}>{tool?.name}</div>
										<div className={styles.subItemDesc}>
											{tool?.description}
										</div>
									</div>
									<div className={styles.subItemMenu}>
										<Button
											block
											disabled={usableCache.has(tool?.code)}
											icon={
												usableCache.has(tool?.code) ? null : (
													<IconPlus size={20} />
												)
											}
											onClick={() => onToolAdd?.(tool, item?.id)}
										>
											{t(
												usableCache.has(tool?.code)
													? "common.tool.card.added"
													: "common.tool.card.add",
											)}
										</Button>
									</div>
								</div>
							))}
						</MagicScrollBar>
					</div>
				</>
			)}
		</div>
	)
}
