import type { AlertProps } from "antd"
import { Alert } from "antd"
import { memo } from "react"
import { IconInfoCircle } from "@tabler/icons-react"
import { useStyles } from "./style"

export type MagicAlertProps = AlertProps

const MagicAlert = memo(({ className, type, ...props }: MagicAlertProps) => {
	const { styles, cx } = useStyles()

	return (
		<Alert
			{...props}
			className={cx(styles.magicAlert, className)}
			type={type}
			icon={<IconInfoCircle size={18} color="currentColor" />}
		/>
	)
})

export default MagicAlert
