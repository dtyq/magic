import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/models/user"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import { useMemoizedFn } from "ahooks"
import { userTransformer, type UserInfoTransformerInput } from "@/models/user/transformers"
import type { User } from "@/types/user"
import { trackLogger } from "@/utils/log/trackLogger"

/**
 * 获取当前用户信息
 */
export function useUserInfo() {
	const [userInfo, setUserInfo] = useState<User.UserInfo | null>(userStore.user.userInfo)

	useEffect(() => {
		return reaction(
			() => userStore.user.userInfo,
			(info) => {
				setUserInfo(info)
				trackLogger.setConfig({
					userId: info?.magic_id ?? "",
				})
			},
		)
	}, [])

	/** 与 store 合并后再写入，避免 PATCH 返回体缺少头像等字段时把展示态清空。 */
	const set = useMemoizedFn((info: UserInfoTransformerInput | null) => {
		service
			.get<UserService>("userService")
			.setUserInfo(info ? userTransformer(info, userStore.user.userInfo) : null)
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
