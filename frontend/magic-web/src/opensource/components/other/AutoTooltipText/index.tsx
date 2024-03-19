import { useMemoizedFn } from "ahooks"
import { Typography } from "antd"
import { createStyles, cx } from "antd-style"
import type { TextProps } from "antd/es/typography/Text"
import { debounce } from "lodash-es"
import { memo, useEffect, useRef, useState } from "react"

interface AutoTooltipTextProps extends TextProps {
	maxWidth?: number
}

const useStyles = createStyles(({ css }) => ({
	text: css`
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: inline-block;
	`,
}))

function RawAutoTooltipText({
	children,
	maxWidth,
	style,
	className,
	...props
}: AutoTooltipTextProps) {
	const { styles } = useStyles({ maxWidth })
	const [isEllipsis, setIsEllipsis] = useState<boolean>(false)
	const colRef = useRef<any>()
	const handleEllipsis = useMemoizedFn(() => {
		if (colRef.current?.clientWidth < colRef.current?.scrollWidth) {
			setIsEllipsis(true)
		} else {
			setIsEllipsis(false)
		}
	})
	useEffect(() => {
		// 第一次进入页面也需要知道文本是否溢出
		handleEllipsis()

		const windowChange = debounce(handleEllipsis, 500)
		window.addEventListener("resize", windowChange)
		return () => {
			window.removeEventListener("resize", windowChange)
			windowChange.cancel()
		}
	}, [handleEllipsis])

	return (
		<Typography.Text
			ref={colRef}
			className={cx(styles.text, className)}
			style={{ maxWidth, ...style }}
			ellipsis={
				isEllipsis
					? {
							tooltip: {
								title: children,
							},
						}
					: false
			}
			{...props}
		>
			{children}
		</Typography.Text>
	)
}

const AutoTooltipText = memo(RawAutoTooltipText)

export default AutoTooltipText
