import { useMemo } from "react"
import { useMatch } from "react-router"
import { RoutePath } from "@/opensource/constants/routes"

interface NewTopicShareRouteReturn {
	isFileShare: false
	resourceId: string | undefined
	isLegacy: false
}

/**
 * Hook for handling new topic share route: /share/topic/{resourceId}
 */
export default function useNewTopicShareRoute(): NewTopicShareRouteReturn {
	const topicShareMatch = useMatch({
		path: RoutePath.SuperMagicTopicShareNew,
		end: true,
	})

	return useMemo(() => {
		if (topicShareMatch) {
			return {
				isFileShare: false,
				resourceId: topicShareMatch.params.resourceId,
				isLegacy: false,
			}
		}

		return {
			isFileShare: false,
			resourceId: undefined,
			isLegacy: false,
		}
	}, [topicShareMatch])
}
