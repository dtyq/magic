import { useStyles } from "./styles"
import ActionButton from "../ActionButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { Switch } from "antd"
import { DropdownDelegateProps } from "../SuperMagicDropdown"
import { ScheduledTask } from "@/opensource/types/scheduledTask"

interface SiderTaskItemProps extends DropdownDelegateProps<ScheduledTask.Task> {
	data: ScheduledTask.Task
	onSwitchChange?: (enabled: boolean) => void
}

export default function SiderTaskItem({
	data,
	onSwitchChange,
	onDropdownActionClick,
	onDropdownContextMenuClick,
}: SiderTaskItemProps) {
	const { cx, styles } = useStyles()

	const handleActionClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (onDropdownActionClick) {
			onDropdownActionClick(event, data)
		}
	}

	const handleContextMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (onDropdownContextMenuClick) {
			onDropdownContextMenuClick(event, data)
		}
	}

	const handleSwitchChange = (checked: boolean) => {
		if (onSwitchChange) {
			onSwitchChange(checked)
		}
	}

	return (
		<div className={cx(styles.item)} onContextMenu={handleContextMenuClick}>
			<div className={styles.arrowIcon}></div>
			<Switch size="small" checked={data?.enabled === 1} onChange={handleSwitchChange} />
			<div className={styles.name}>{data?.task_name || "-"}</div>
			<div className={styles.moreActionButton}>
				<ActionButton size={20} onClick={handleActionClick}>
					<MagicIcon
						className={styles.arrowIcon}
						size={18}
						component={IconDots}
						stroke={2}
					/>
				</ActionButton>
			</div>
		</div>
	)
}
