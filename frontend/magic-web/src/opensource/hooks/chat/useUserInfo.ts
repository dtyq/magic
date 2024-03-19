import { useMemo } from "react"
import userInfoStore from "@/opensource/stores/userInfo"
import { computed } from "mobx"

/**
 * 获取多个用户信息
 * @param uid 用户ID
 */
const useUserInfo = (uid?: string | null) => {
	const userInfo = useMemo(() => {
		return computed(() => (uid ? userInfoStore.get(uid) : undefined))
	}, [uid]).get()

	return { userInfo }
}

export default useUserInfo
