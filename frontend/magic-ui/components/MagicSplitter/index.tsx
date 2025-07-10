import type { SplitterProps } from "antd"
import { Splitter } from "antd"
import type { PropsWithChildren } from "react"
import { memo } from "react"
import { useStyles } from "./style"

export type MagicSplitterProps = PropsWithChildren<SplitterProps>

const MagicSplitter = memo(function MagicSplitter({
	className,
	children,
	...props
}: MagicSplitterProps) {
	const { styles, cx } = useStyles()

	return (
		<Splitter className={cx(styles.splitter, className)} {...props}>
			{children}
		</Splitter>
	)
})

// @ts-ignore
MagicSplitter.Panel = Splitter.Panel

type CompoundedComponent = typeof MagicSplitter & {
	Panel: typeof Splitter.Panel
}

export default MagicSplitter as CompoundedComponent
