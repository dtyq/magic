import { Flow, FlowRouteType } from "@/opensource/types/flow"
import defaultToolAvatar from "@/opensource/assets/logos/tool-avatar.png"
import defaultFlowAvatar from "@/opensource/assets/logos/flow-avatar.png"
import defaultMcpAvatar from "@/opensource/assets/logos/mcp.png"

export const defaultAvatarMap: Record<string, string> = {
	[FlowRouteType.Tools]: defaultToolAvatar,
	[FlowRouteType.Sub]: defaultFlowAvatar,
	[FlowRouteType.Mcp]: defaultMcpAvatar,
}

export const flowTypeToApiKeyType: Record<FlowRouteType, Flow.ApiKeyType> = {
	[FlowRouteType.Agent]: Flow.ApiKeyType.Flow,
	[FlowRouteType.Sub]: Flow.ApiKeyType.Flow,
	[FlowRouteType.Tools]: Flow.ApiKeyType.Flow,
	[FlowRouteType.VectorKnowledge]: Flow.ApiKeyType.Flow,
	[FlowRouteType.Mcp]: Flow.ApiKeyType.Mcp,
}
