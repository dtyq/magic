import { useStyles } from "./styles"
import type { Flow } from "@/opensource/types/flow"
import MagicImage from "@/opensource/components/base/MagicImage"
import { Flex, Switch, Dropdown } from "antd"
import { IconMCP } from "@/opensource/enhance/tabler/icons-react"
import {
	IconTools,
	IconAlertCircleFilled,
	IconCircleCheckFilled,
	IconDots,
	IconEdit,
	IconTrash,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import { useMemo } from "react"
import {
	hasAdminRight,
	hasEditRight,
} from "@/opensource/pages/flow/components/AuthControlButton/types"

interface MCPCardProps {
	item: Flow.Mcp.ListItem
	className?: string
	/** 是否选中 */
	selected?: boolean
	/** 编辑 */
	onEdit?: (item: Flow.Mcp.ListItem) => void
	/** 删除 */
	onDelete?: (item: Flow.Mcp.ListItem) => void
	/** 穿透点击事件 */
	onClick?: (item: Flow.Mcp.ListItem) => void
	/** 修改成功回调 */
	onStatusChange?: (item: Flow.Mcp.ListItem) => void
}

const enum CardMenuItemType {
	Edit = "edit",
	Delete = "delete",
}

export default function MCPCard(props: MCPCardProps) {
	const { item, className, selected, onEdit, onDelete, onClick, onStatusChange } = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")

	const onMenuItemClick = useMemoizedFn(async (event) => {
		switch (event.key) {
			case CardMenuItemType.Edit:
				onEdit?.(item)
				break
			case CardMenuItemType.Delete:
				onDelete?.(item)
				break
			default:
		}
	})

	const items = useMemo(() => {
		const menuItems = []
		if (hasEditRight(item.user_operation)) {
			menuItems.push({
				label: t("mcp.page.contextMenu.edit"),
				key: CardMenuItemType.Edit,
				icon: <IconEdit size={18} />,
			})
		}
		if (hasAdminRight(item?.user_operation)) {
			menuItems.push({
				label: t("mcp.page.contextMenu.delete"),
				key: CardMenuItemType.Delete,
				icon: <IconTrash size={18} />,
				danger: true,
			})
		}
		return menuItems
	}, [item.user_operation, t])

	const container = (
		<div
			className={cx(styles.wrapper, {
				[styles.active]: selected,
			})}
			onClick={() => onClick?.(item)}
		>
			<div className={styles.header}>
				<MagicImage
					className={styles.icon}
					src={item?.icon}
					alt={item?.name}
					fallback={
						<div className={styles.fallback}>
							<IconMCP size="100%" />
						</div>
					}
				/>
				<div className={styles.section}>
					<div className={styles.title}>
						{item?.name}
						{hasEditRight(item.user_operation) && (
							<Dropdown
								menu={{ items, onClick: onMenuItemClick }}
								trigger={["click"]}
							>
								<span className={styles.button}>
									<IconDots size={24} />
								</span>
							</Dropdown>
						)}
					</div>
					<span className={styles.desc}>{item?.description || t("mcp.card.desc")}</span>
				</div>
			</div>
			<div className={styles.menu}>
				<div className={styles.nav}>
					<div className={styles.tag}>
						<IconTools size={12} color={colorScales.brand[5]} />
						{t("mcp.card.toolsCount", { count: item?.tools_count || 0 })}
					</div>
					{/* 后端未实现，前端先隐藏 */}
					{/* <div className={styles.tag}>
						{item?.agent_used_count > 0 ? (
							<>
								{t("mcp.card.quoteAgent", {
									count: item?.agent_used_count || 0,
								})}
								<IconCircleCheckFilled size={12} color={colorScales.green[4]} />
							</>
						) : (
							<>
								{t("mcp.card.noQuote")}
								<IconAlertCircleFilled size={12} color={colorScales.orange[5]} />
							</>
						)}
					</div> */}
				</div>
				<Flex gap={8}>
					<span className={styles.switchLabel}>{t("mcp.card.status")}</span>
					<Switch
						disabled={!hasEditRight(item?.user_operation)}
						checked={item.enabled}
						onChange={() => onStatusChange?.(item)}
						size="small"
					/>
				</Flex>
			</div>
			<div className={styles.footer}>
				<span>
					{t("mcp.card.creator")} {item?.creator_info?.name}
				</span>
				<span>
					{t("mcp.card.creatAt")} {item?.created_at}
				</span>
			</div>
		</div>
	)

	return (
		<a className={cx(styles.card, className)}>
			<Dropdown menu={{ items, onClick: onMenuItemClick }} trigger={["contextMenu"]}>
				{container}
			</Dropdown>
		</a>
	)
}
