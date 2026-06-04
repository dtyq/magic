import { Flex } from "antd"
import { memo, useMemo } from "react"
import { useStyles } from "./style"

export interface SubHeaderProps {
	/* 标题 */
	title: string
	/* 描述 */
	description?: string | React.ReactNode
	/* 额外内容 */
	extra?: React.ReactNode
	className?: string
	style?: React.CSSProperties
}

const SubHeader = ({ title, description, extra, className, style }: SubHeaderProps) => {
	const { styles, cx } = useStyles()

	const getDescription = useMemo(() => {
		if (!description) return null

		if (typeof description === "string") {
			return <div className={styles.description}>{description}</div>
		}
		return description
	}, [description, styles.description])

	return (
		<Flex
			className={cx(styles.header, className)}
			justify="space-between"
			align="center"
			style={style}
		>
			<Flex gap={10} align="center">
				<div className={styles.title}>{title}</div>
				{getDescription}
			</Flex>
			{extra}
		</Flex>
	)
}

export default memo(SubHeader)
