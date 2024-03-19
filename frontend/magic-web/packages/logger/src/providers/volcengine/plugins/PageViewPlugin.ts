import { routesMatch } from "@/opensource/routes/history/helpers"

interface PidExtractor {
	(url: string): string
}

interface PageviewProps {
	sendInit: boolean
	routeMode: "history" | "hash" | "manual"
	extractPid?: PidExtractor
	apdex?: 0 | 1 | 2
}

export const plugin = (): Partial<PageviewProps> => {
	return {
		sendInit: true,
		routeMode: "history",
		extractPid: (url) => {
			const uri = new URL(url)
			return routesMatch(uri.pathname)?.route?.path || uri.pathname
		},
	}
}
