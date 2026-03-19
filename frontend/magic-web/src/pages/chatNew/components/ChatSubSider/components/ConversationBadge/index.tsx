import type { BadgeProps } from "antd"
import { Badge } from "antd"
import { memo, useMemo } from "react"

const ConversationBadge = memo(
	({ count = 0, children, ...props }: BadgeProps & { count?: number }) => {
		const offsetXSize = useMemo(() => {
			if (count) {
				const stringCount = count.toString()
				return -40 + stringCount.length * 2.5
			}
			return -40
		}, [count])

		return (
			<Badge offset={[offsetXSize, 0]} count={count} {...props}>
				{children}
			</Badge>
		)
	},
)

export default ConversationBadge
