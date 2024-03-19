import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/opensource/models/user"

/**
 * 获取当前用户信息
 */
export function useAccount() {
	const [accounts, setAccounts] = useState(userStore.account.accounts)

	useEffect(() => {
		return reaction(
			() => userStore.account.accounts,
			(o) => setAccounts(o),
		)
	}, [])

	return { accounts }
}
