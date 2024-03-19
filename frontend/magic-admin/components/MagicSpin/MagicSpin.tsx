import type { SpinProps } from "antd"
import { Spin } from "antd"
import { memo } from "react"
import { useStyles } from "./style"

export type MagicSpinProps = SpinProps

const MagicSpin = memo(({ className, ...props }: MagicSpinProps) => {
	const { styles, cx } = useStyles()
	return <Spin wrapperClassName={cx(styles.magicSpin, className)} {...props} />
})

export default MagicSpin
