import { useCallback, useEffect, useRef, useState } from "react"
import groupInfoStore from "@/opensource/stores/groupInfo"
import groupInfoService from "@/opensource/services/groupInfo"

/**
 * 获取多个用户信息
 * @param uid 用户ID
 */
const useGroupInfo = (uid?: string | null, force: boolean = false) => {
	const groupInfo = uid ? groupInfoStore.get(uid) : undefined

	const [isMutating, setIsMutating] = useState(false)
	const refreshGroupInfo = useCallback(
		(group_ids: string[]) => {
			setIsMutating(true)
			return groupInfoService.fetchGroupInfos(group_ids).finally(() => {
				setIsMutating(false)
			})
		},
		[groupInfoService],
	)

	const forced = useRef(false)
	useEffect(() => {
		if ((!groupInfo || force) && uid && !forced.current) {
			refreshGroupInfo([uid]).then(() => {
				forced.current = true
			})
		}
	}, [force, uid, groupInfo, groupInfoService, refreshGroupInfo])

	return { groupInfo, refreshGroupInfo, isMutating }
}

export default useGroupInfo
