import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/opensource/models/user"
import { service } from "@/opensource/services"
import type { UserService } from "@/opensource/services/user/UserService"
import { useMemoizedFn } from "ahooks"

/**
 * 获取当前用户token
 */
export function useAuthorization() {
	const [authorization, setAuthorization] = useState(userStore.user.authorization)

	useEffect(() => {
		return reaction(
			() => userStore.user.authorization,
			(token) => setAuthorization(token),
		)
	}, [])

	const set = useMemoizedFn((token) => {
		service.get<UserService>("userService").setAuthorization(token)
	})

	return { authorization, setAuthorization: set }
}
