import { useMemo } from "react"
import { useMatch } from "react-router"
import { RoutePath } from "@/constants/routes"

interface LegacyFileShareRouteReturn {
	isFileShare: boolean
	topicId: string | undefined
	fileId: string | undefined
	isLegacy: true
}

/**
 * Hook for handling legacy file share route: /share/{topicId}/file/{fileId}
 */
export default function useLegacyFileShareRoute(): LegacyFileShareRouteReturn {
	const fileShareMatch = useMatch({
		path: RoutePath.SuperMagicFileShare,
		end: true,
	})

	return useMemo(() => {
		if (fileShareMatch) {
			return {
				isFileShare: true,
				topicId: fileShareMatch.params.topicId,
				fileId: fileShareMatch.params.fileId,
				isLegacy: true,
			}
		}

		return {
			isFileShare: false,
			topicId: undefined,
			fileId: undefined,
			isLegacy: true,
		}
	}, [fileShareMatch])
}
