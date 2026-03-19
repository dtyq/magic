import { memo } from "react"
import { useStyles } from "./styles"
import { Flex } from "antd"

interface ToolContainerProps {
	children: React.ReactNode
	withDetail?: boolean // with tool detail component
	className?: string
}

function ToolContainer({ children, withDetail, className }: ToolContainerProps) {
	const { styles, cx } = useStyles()

	return (
		<Flex
			className={cx(
				styles.container,
				{
					[styles.withDetail]: withDetail,
				},
				className,
			)}
		>
			{children}
		</Flex>
	)
}

export default memo(ToolContainer)
