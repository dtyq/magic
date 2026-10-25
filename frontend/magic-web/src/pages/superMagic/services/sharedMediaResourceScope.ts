import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/models/user"

/**
 * Returns the browser-local scope used by media URL/body caches.
 *
 * Signed URLs are permission-bearing values.  The scope deliberately includes
 * the active organization and user identity so a logout/org switch cannot
 * reuse a URL issued for another account, while all same-user entry points and
 * tabs still share the same cache namespace.
 */
export function getSharedMediaResourceScope(): string {
	try {
		const userInfo = userStore.user.userInfo
		const organizationCode =
			userStore.user.organizationCode || userInfo?.organization_code || ""
		const userId = userInfo?.magic_id || userInfo?.user_id || ""
		if (organizationCode || userId) {
			return `org:${organizationCode || "unknown"}|user:${userId || "unknown"}`
		}

		if (typeof window !== "undefined" && window.location.pathname.includes("magic-share")) {
			return `share:${window.location.pathname}`
		}
	} catch {
		// Cache identity must remain total even while auth state is bootstrapping.
	}

	return "anonymous"
}

/** Reactive scope for components that keep permission-bearing media resources. */
export function useSharedMediaResourceScope(): string {
	const [scope, setScope] = useState(getSharedMediaResourceScope)

	useEffect(() => {
		return reaction(
			() => {
				const userInfo = userStore.user.userInfo
				return [
					userStore.user.organizationCode,
					userInfo?.organization_code,
					userInfo?.magic_id,
					userInfo?.user_id,
				]
			},
			() => {
				setScope(getSharedMediaResourceScope())
			},
			{
				fireImmediately: true,
			},
		)
	}, [])

	return scope
}
