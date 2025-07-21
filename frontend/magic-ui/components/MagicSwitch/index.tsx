import { Switch, type SwitchProps } from "antd"
import { useStyles } from "./style"

export type MagicSwitchProps = SwitchProps

function MagicSwitch({ className, ...props }: MagicSwitchProps) {
	const { styles, cx } = useStyles()

	return <Switch className={cx(styles.magicSwitch, className)} {...props} />
}

export default MagicSwitch
