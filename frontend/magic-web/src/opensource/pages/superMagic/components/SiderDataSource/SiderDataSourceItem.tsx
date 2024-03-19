import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import { useStyles } from "./styles"
import ActionButton from "../ActionButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { DataSourceItemData } from "./types"
import { DropdownDelegateProps } from "../SuperMagicDropdown"

interface SiderDataSourceItemProps extends DropdownDelegateProps<DataSourceItemData> {
	data: DataSourceItemData
}

export default function SiderDataSourceItem({ data, ...delegateProps }: SiderDataSourceItemProps) {
	const { styles } = useStyles()

	const handleActionClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (delegateProps.onDropdownActionClick) {
			delegateProps.onDropdownActionClick(event, data)
		}
	}

	const handleContextMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (delegateProps.onDropdownContextMenuClick) {
			delegateProps.onDropdownContextMenuClick(event, data)
		}
	}

	return (
		<div className={styles.item} onContextMenu={handleContextMenuClick}>
			<div className={styles.arrowIcon}></div>
			<MagicFileIcon
				className={styles.fileIcon}
				type={data.type === "database" ? "mysql" : "xls"}
				size={18}
			/>
			<div className={styles.name}>{data.name}</div>
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
