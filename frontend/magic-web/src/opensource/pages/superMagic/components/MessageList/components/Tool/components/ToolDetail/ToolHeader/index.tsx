import { Flex } from "antd"
import { useStyles } from "./styles"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"

interface ToolHeaderProps {
	extension?: string
	title?: string
	icon?: React.ReactNode
	suffix?: React.ReactNode
	showTitle?: boolean
	headerClassName?: string
}

export default function ToolHeader({
	extension,
	title,
	icon,
	suffix,
	showTitle = true,
	headerClassName,
}: ToolHeaderProps) {
	const { styles, cx } = useStyles()

	return (
		<Flex
			className={cx(styles.commonHeader, headerClassName)}
			justify="space-between"
			align="center"
		>
			<Flex className={cx(styles.titleContainer)} gap={4} align="center">
				{showTitle && (
					<>
						<div className={styles.icon}>
							{icon || <MagicFileIcon size={20} type={extension} />}
						</div>
						<span
							className={styles.title}
							title={typeof title === "string" ? title : undefined}
						>
							{title}
						</span>
					</>
				)}
				{suffix}
			</Flex>
		</Flex>
	)
}
