import { memo, useMemo } from "react"
import defaultFlowAvatar from "@/opensource/assets/logos/flow-avatar.png"
import defaultToolAvatar from "@/opensource/assets/logos/tool-avatar.png"
import defaultAgentAvatar from "@/opensource/assets/logos/agent-avatar.jpg"
import defaultMCPAvatar from "@/opensource/assets/logos/mcp.png"
import defaultKnowledgeAvatar from "@/opensource/assets/logos/knowledge-avatar.png"
import { FlowRouteType } from "@/opensource/types/flow"
import type { DefaultAvatarProps } from "./types"
import { useStyles } from "./styles"

/**
 * DefaultAvatar - Default avatar component for different flow types
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
const DefaultAvatar = memo(({ type, className, size = 50, ...props }: DefaultAvatarProps) => {
	const { styles, cx } = useStyles({ size })

	const avatarSrc = useMemo(() => {
		switch (type) {
			case FlowRouteType.Sub:
				return defaultFlowAvatar
			case FlowRouteType.Tools:
				return defaultToolAvatar
			case FlowRouteType.VectorKnowledge:
				return defaultKnowledgeAvatar
			case FlowRouteType.Mcp:
				return defaultMCPAvatar
			default:
				return defaultAgentAvatar
		}
	}, [type])

	return (
		<img
			src={avatarSrc}
			className={cx(styles.defaultAvatar, className)}
			alt={type}
			{...props}
		/>
	)
})

DefaultAvatar.displayName = "DefaultAvatar"

export default DefaultAvatar
