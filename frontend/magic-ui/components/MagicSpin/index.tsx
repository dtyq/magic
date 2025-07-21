import type { SpinProps } from "antd"
import { Spin } from "antd"
import { memo } from "react"
import { useMagicSpinProps } from "./style"
import { cx } from "antd-style"

export type MagicSpinProps = SpinProps

const MagicSpin = memo(function MagicSpin({ children, size, className, ...props }: MagicSpinProps) {
	const magicSpinProps = useMagicSpinProps(size)

	return (
		<Spin
			{...magicSpinProps}
			wrapperClassName={cx(magicSpinProps.wrapperClassName, className)}
			{...props}
		>
			{children}
		</Spin>
	)
})

export default MagicSpin
