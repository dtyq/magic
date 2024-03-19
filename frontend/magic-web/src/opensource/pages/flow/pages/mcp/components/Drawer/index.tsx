import { Flex } from "antd"
import { PropsWithChildren } from "react"
import { useStyles } from "./styles"
import { IconX } from "@tabler/icons-react"

interface AgentDrawerProps {
	open?: boolean
	onClose?: () => void
}

export default function Drawer(props: PropsWithChildren<AgentDrawerProps>) {
	const { styles, cx } = useStyles(props?.open)

	return (
		<Flex vertical gap={10} className={cx(styles.drawer)}>
			<div className={styles.drawerContainer}>
				<div className={styles.close}>
					<IconX size={24} onClick={props?.onClose} />
				</div>
				{props?.children}
			</div>
		</Flex>
	)
}
