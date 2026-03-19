import { Dropdown, Flex, Switch } from "antd"
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react"
import { useStyles } from "./styles"
import type { Flow } from "@/types/flow"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

interface ToolItemProps {
	item: Flow.Mcp.Detail
	role?: {
		edit?: boolean
		delete?: boolean
	}
	classNames?: {
		wrapper?: string
	}
	/** 编辑 */
	onEdit?: (item: Flow.Mcp.ListItem) => void
	/** 删除 */
	onDelete?: (item: Flow.Mcp.ListItem) => void
	/** 修改成功回调 */
	onStatusChange?: (item: Flow.Mcp.ListItem) => void
	/** 版本更新 */
	onVersionUpdate?: (item: Flow.Mcp.ListItem) => void
}

const enum ToolMenuItemType {
	Edit = "edit",
	Delete = "delete",
}

export default function ToolItem(props: ToolItemProps) {
	const { item, role, onEdit, onDelete, onStatusChange, onVersionUpdate, classNames } = props

	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")

	const items = useMemo(() => {
		const menuItems = []
		if (role?.edit) {
			menuItems.push({
				label: t("mcp.card.editTool"),
				key: ToolMenuItemType.Edit,
				icon: <IconEdit size={18} />,
			})
		}
		if (role?.delete) {
			menuItems.push({
				label: t("mcp.card.deleteTool"),
				key: ToolMenuItemType.Delete,
				icon: <IconTrash size={18} />,
				danger: true,
			})
		}
		return menuItems
	}, [role?.delete, role?.edit, t])

	const onMenuItemClick = useMemoizedFn((event) => {
		switch (event.key) {
			case ToolMenuItemType.Edit:
				onEdit?.(item)
				break
			case ToolMenuItemType.Delete:
				onDelete?.(item)
				break
			default:
		}
	})

	return (
		<div className={cx(styles.item, classNames?.wrapper)}>
			<div className={styles.itemHeader}>
				<div className={styles.itemTitle}>{item?.name}</div>
				<Flex align="center" gap={4}>
					<Switch
						checked={item?.enabled}
						size="small"
						onChange={() => onStatusChange?.(item)}
					/>
					<Dropdown menu={{ items, onClick: onMenuItemClick }} trigger={["click"]}>
						<div className={styles.itemButton}>
							<IconDots size={20} />
						</div>
					</Dropdown>
				</Flex>
			</div>
			{item?.source_version?.latest_version_name &&
				item?.source_version?.latest_version_name !== item?.version && (
					<div className={styles.itemDesc}>
						<span className={styles.itemDesc}>{item?.version}</span>
						<span className={styles.itemTag} onClick={() => onVersionUpdate?.(item)}>
							{item?.source_version?.latest_version_name}
						</span>
					</div>
				)}
			<div className={styles.itemFooter}>{item?.description || t("mcp.card.desc")}</div>
		</div>
	)
}
