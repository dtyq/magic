import { Switch, type SwitchProps } from "antd"
import { memo } from "react"
import { useStyles } from "./style"

export type MagicSwitchProps = SwitchProps

const MagicSwitch = memo(({ className, ...props }: MagicSwitchProps) => {
	const { styles, cx } = useStyles()
	return <Switch className={cx(styles.magicSwitch, className)} {...props} />
})

export default MagicSwitch
