import { useMemo } from "react"
import { useLocation, useMatch } from "react-router"
import { RoutePath } from "@/opensource/constants/routes"

interface LegacyTopicShareRouteReturn {
	isFileShare: false
	topicId: string | undefined
	isLegacy: true
}

/**
 * Hook for handling legacy topic share route: /share/{topicId}
 */
export default function useLegacyTopicShareRoute(): LegacyTopicShareRouteReturn {
	const { pathname } = useLocation()

	// Match legacy topic share route: /share/{topicId}
	const shareMatch = useMatch({
		path: RoutePath.SuperMagicShare,
		end: false,
	})

	return useMemo(() => {
		// Check if it matches legacy topic share pattern (not file share, not new format)
		if (shareMatch) {
			const pathSegments = pathname.replace("/share/", "").split("/")
			const firstSegment = pathSegments[0]

			// Exclude new format routes: /share/files/{resourceId} and /share/topic/{resourceId}
			if (firstSegment === "files" || firstSegment === "topic") {
				return {
					isFileShare: false,
					topicId: undefined,
					isLegacy: true,
				}
			}

			// Exclude legacy file share pattern: /share/{topicId}/file/{fileId}
			if (pathSegments.length > 1 && pathSegments[1] === "file") {
				return {
					isFileShare: false,
					topicId: undefined,
					isLegacy: true,
				}
			}

			return {
				isFileShare: false,
				topicId: firstSegment || undefined,
				isLegacy: true,
			}
		}

		return {
			isFileShare: false,
			topicId: undefined,
			isLegacy: true,
		}
	}, [shareMatch, pathname])
}
