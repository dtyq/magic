import { Badge, BadgeProps } from "antd"

const MagicBadge = (props: BadgeProps) => {
	if (props.count === 0) {
		return props.children
	}
	return <Badge {...props} />
}

export default MagicBadge
