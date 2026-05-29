import type { DrawerProps } from "antd"
import { Drawer, Descriptions } from "antd"
import type { DescriptionsItemType } from "antd/es/descriptions"
import type { DescriptionsProps } from "antd/lib"
import { useStyles } from "./style"

export interface DetailDrawerProps extends DrawerProps {
	items: DescriptionsItemType[]
	descriptionProps?: Omit<DescriptionsProps, "items">
}

function DetailDrawer({
	open,
	title,
	items,
	onClose,
	descriptionProps,
	...props
}: DetailDrawerProps) {
	const { styles } = useStyles()

	if (!items) return null

	return (
		<Drawer
			title={title}
			placement="bottom"
			onClose={onClose}
			open={open}
			height="80vh"
			className={styles.drawer}
			{...props}
		>
			<Descriptions column={1} bordered size="small" items={items} {...descriptionProps} />
		</Drawer>
	)
}

export default DetailDrawer
