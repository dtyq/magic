import { RouteName } from "@/routes/constants"
import { getRoutePath } from "@/routes/history/helpers"
import { clipboard } from "@/utils/clipboard-helpers"

/** Builds the shareable absolute URL that opens the Super Magic homepage with one crew selected. */
export function buildCrewUsageLink(agentCode: string, origin = window.location.origin): string {
	const path = getRoutePath({ name: RouteName.Super, query: { agentCode } })
	if (!path) throw new Error("crew-usage-link-route-unavailable")
	return new URL(path, origin).toString()
}

/** Copies a crew usage link through the shared browser and DingTalk compatible clipboard adapter. */
export async function copyCrewUsageLink(agentCode: string): Promise<string> {
	const link = buildCrewUsageLink(agentCode)
	await clipboard.writeText(link)
	return link
}
