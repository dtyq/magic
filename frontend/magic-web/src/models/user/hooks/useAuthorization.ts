import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/models/user"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
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
