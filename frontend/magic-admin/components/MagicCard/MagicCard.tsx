import { Flex, Tooltip } from "antd"
import type { ReactNode } from "react"
import { memo } from "react"
import { useStyles } from "./style"

export interface MagicCardProps {
	/* 头像 */
	avatar: ReactNode
	/* 标题 */
	title: string | ReactNode
	/* 标签 */
	tag?: string
	/* 描述 */
	description: string | ReactNode
	/* 左侧操作 */
	leftAction?: ReactNode
	/* 右侧操作 */
	rightAction?: ReactNode
	/* 类名 */
	className?: string
	/* 样式 */
	style?: React.CSSProperties
	/* 两行描述 */
	is2LineClamp?: boolean
}

const MagicCard = memo(
	({
		avatar,
		title,
		tag,
		description,
		leftAction,
		rightAction,
		className,
		style,
		is2LineClamp = true,
	}: MagicCardProps) => {
		const { styles, cx } = useStyles()
		const isString = typeof title === "string"
		return (
			<Flex gap={8} className={cx(styles.container, className)} style={style}>
				{avatar}
				<Flex vertical gap={8} justify="space-between" style={{ flex: 1 }}>
					<Flex vertical gap={4}>
						<Flex gap={8}>
							<Tooltip title={isString ? title : ""}>
								<div className={styles.title}>{title}</div>
							</Tooltip>
							{tag && <div className={styles.tag}>{tag}</div>}
						</Flex>
						<div className={cx(styles.description, is2LineClamp && styles.lineClamp2)}>
							{description}
						</div>
					</Flex>
					{(leftAction || rightAction) && (
						<Flex justify="space-between" align="center">
							{leftAction}
							{rightAction}
						</Flex>
					)}
				</Flex>
			</Flex>
		)
	},
)

export default MagicCard
