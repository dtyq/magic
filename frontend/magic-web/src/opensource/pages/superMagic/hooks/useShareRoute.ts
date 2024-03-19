import { useMemo } from "react"
import { useMatch } from "react-router"
import { RoutePath } from "@/opensource/constants/routes"
import useLegacyFileShareRoute from "./useLegacyFileShareRoute"
import useLegacyTopicShareRoute from "./useLegacyTopicShareRoute"
import useNewFileShareRoute from "./useNewFileShareRoute"
import useNewTopicShareRoute from "./useNewTopicShareRoute"

interface ShareParams {
	topicId: string | undefined
	fileId: string | undefined
	resourceId: string | undefined
}

interface ShareRouteReturn {
	isShareRoute: boolean
	isFileShare: boolean
	isMagicShareRoute: boolean
	shareParams: ShareParams
	isLegacy: boolean
}

/**
 * 使用路由匹配来判断分享路径的 Hook
 * 按优先级匹配：新文件分享 → 新话题分享 → 旧文件分享 → 旧话题分享
 *
 * @returns {ShareRouteReturn} 包含分享路径状态和参数的对象
 */
export default function useShareRoute(): ShareRouteReturn {
	// Try new format routes first
	const newFileShare = useNewFileShareRoute()
	const newTopicShare = useNewTopicShareRoute()

	// Then try legacy format routes
	const legacyFileShare = useLegacyFileShareRoute()
	const legacyTopicShare = useLegacyTopicShareRoute()

	// Match magic share route
	const magicShareMatch = useMatch({
		path: RoutePath.MagicShare,
		end: false,
	})

	return useMemo(() => {
		// Priority 1: New file share route
		if (newFileShare.resourceId) {
			return {
				isShareRoute: true,
				isFileShare: true,
				isMagicShareRoute: !!magicShareMatch,
				shareParams: {
					topicId: undefined,
					fileId: undefined,
					resourceId: newFileShare.resourceId,
				},
				isLegacy: false,
			}
		}

		// Priority 2: New topic share route
		if (newTopicShare.resourceId) {
			return {
				isShareRoute: true,
				isFileShare: false,
				isMagicShareRoute: !!magicShareMatch,
				shareParams: {
					topicId: newTopicShare.resourceId, // resourceId = topicId for topic share
					fileId: undefined,
					resourceId: newTopicShare.resourceId,
				},
				isLegacy: false,
			}
		}

		// Priority 3: Legacy file share route
		if (legacyFileShare.isFileShare && legacyFileShare.topicId && legacyFileShare.fileId) {
			return {
				isShareRoute: true,
				isFileShare: true,
				isMagicShareRoute: !!magicShareMatch,
				shareParams: {
					topicId: legacyFileShare.topicId,
					fileId: legacyFileShare.fileId,
					resourceId: undefined,
				},
				isLegacy: true,
			}
		}

		// Priority 4: Legacy topic share route
		if (legacyTopicShare.topicId) {
			return {
				isShareRoute: true,
				isFileShare: false,
				isMagicShareRoute: !!magicShareMatch,
				shareParams: {
					topicId: legacyTopicShare.topicId,
					fileId: undefined,
					resourceId: undefined,
				},
				isLegacy: true,
			}
		}

		// No match
		return {
			isShareRoute: false,
			isFileShare: false,
			isMagicShareRoute: !!magicShareMatch,
			shareParams: {
				topicId: undefined,
				fileId: undefined,
				resourceId: undefined,
			},
			isLegacy: false,
		}
	}, [newFileShare, newTopicShare, legacyFileShare, legacyTopicShare, magicShareMatch])
}
