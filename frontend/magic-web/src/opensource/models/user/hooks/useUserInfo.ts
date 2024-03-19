import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/opensource/models/user"
import { service } from "@/opensource/services"
import type { UserService } from "@/opensource/services/user/UserService"
import { useMemoizedFn } from "ahooks"
import { userTransformer } from "@/opensource/models/user/transformers"
import type { StructureUserItem } from "@/opensource/types/organization"
import { trackLogger } from "@/opensource/utils/log/trackLogger"

/**
 * 获取当前用户信息
 */
export function useUserInfo() {
	const [userInfo, setUserInfo] = useState(userStore.user.userInfo)

	useEffect(() => {
		return reaction(
			() => userStore.user.userInfo,
			(info) => {
				setUserInfo(info)
				trackLogger.setConfig({
					userId: info?.magic_id,
				})
			},
		)
	}, [])

	const set = useMemoizedFn((info: StructureUserItem | null) => {
		service.get<UserService>("userService").setUserInfo(info ? userTransformer(info) : null)
	})

	return { userInfo, setUserInfo: set }
}

export interface GetTeamshareUserDepartmentsResponse {
	id: string
	departments: {
		name: string
		level: number
		id: string
	}[][]
}
