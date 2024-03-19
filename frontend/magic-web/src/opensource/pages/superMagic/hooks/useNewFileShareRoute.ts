import { useMemo } from "react"
import { useMatch } from "react-router"
import { RoutePath } from "@/opensource/constants/routes"

interface NewFileShareRouteReturn {
	isFileShare: true
	resourceId: string | undefined
	isLegacy: false
}

/**
 * Hook for handling new file share route: /share/files/{resourceId}
 */
export default function useNewFileShareRoute(): NewFileShareRouteReturn {
	const fileShareMatch = useMatch({
		path: RoutePath.SuperMagicFilesShare,
		end: true,
	})

	return useMemo(() => {
		if (fileShareMatch) {
			return {
				isFileShare: true,
				resourceId: fileShareMatch.params.resourceId,
				isLegacy: false,
			}
		}

		return {
			isFileShare: true,
			resourceId: undefined,
			isLegacy: false,
		}
	}, [fileShareMatch])
}
