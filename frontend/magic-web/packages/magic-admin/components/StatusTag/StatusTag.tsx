import type { TagProps } from "antd"
import { Tag } from "antd"
import { memo } from "react"
import { useStyles } from "./style"

export type StatusTagProps = TagProps

const StatusTag = memo(({ className, onClick, ...props }: StatusTagProps) => {
	const hasClick = !!onClick
	const { styles, cx } = useStyles({ hasClick })
	return (
		<Tag {...props} className={cx(styles.tag, className)} onClick={onClick}>
			{props.children}
		</Tag>
	)
})

export default StatusTag
