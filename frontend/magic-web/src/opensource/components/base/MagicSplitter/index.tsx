import type { SplitterProps } from "antd"
import { Splitter } from "antd"
import { createStyles } from "antd-style"
import type { PropsWithChildren } from "react"
import { memo } from "react"

const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		splitter: css`
			--${prefixCls}-splitter-split-bar-draggable-size: 0 !important;
			--${prefixCls}-splitter-split-trigger-size: 0 !important;
      

			.${prefixCls}-splitter-panel{
				padding: 0 !important;
				overflow: hidden;
			}

			.${prefixCls}-splitter-bar-dragger::before {
				background-color: transparent !important;

				&:hover {
					background-color: transparent !important;
				}
			}
		`,
	}
})

const MagicSplitter = memo(
	({
		className,
		children,
		hiddenSplitterBar = true,
		...props
	}: PropsWithChildren<SplitterProps & { hiddenSplitterBar?: boolean }>) => {
		const { styles, cx } = useStyles()
		return (
			<Splitter className={cx(hiddenSplitterBar && styles.splitter, className)} {...props}>
				{children}
			</Splitter>
		)
	},
)

// @ts-ignore
MagicSplitter.Panel = Splitter.Panel

type CompoundedComponent = typeof MagicSplitter & {
	Panel: typeof Splitter.Panel
}

export default MagicSplitter as CompoundedComponent
