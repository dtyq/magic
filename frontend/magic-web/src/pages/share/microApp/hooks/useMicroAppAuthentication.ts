import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import { userStore } from "@/models/user"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"

/** Ask before leaving the app; concurrent SDK calls share one login dialog. */
export function useMicroAppAuthentication() {
	const { t } = useTranslation("super")
	const pending = useRef<Promise<void> | null>(null)
	const closeDialog = useRef<(() => void) | null>(null)

	useEffect(() => () => closeDialog.current?.(), [])

	return useMemoizedFn(async () => {
		if (userStore.user.authorization?.trim()) return
		if (pending.current) return pending.current

		const request = new Promise<void>((resolve) => {
			let settled = false
			const finish = () => {
				if (settled) return false
				settled = true
				closeDialog.current = null
				modal.destroy()
				resolve()
				return true
			}
			const modal = MagicModal.confirm({
				title: t("microAppShare.loginRequiredTitle"),
				content: t("microAppShare.loginRequiredDescription"),
				okText: t("microAppShare.loginRequiredConfirm"),
				cancelText: t("common.cancel"),
				centered: true,
				closable: false,
				maskClosable: false,
				onOk: () => {
					if (!finish()) return
					authEventBus.emit(AuthEventName.RequestLogin, {
						reason: "manual",
						source: "share",
						returnTo: window.location.href,
						preserveQuery: true,
					})
				},
				onCancel: finish,
			})
			closeDialog.current = finish
		}).then(() => {
			// Confirmation navigates to login; it never authorizes or replays this operation.
			throw new Error("Authentication required")
		})
		pending.current = request
		try {
			await request
		} finally {
			if (pending.current === request) pending.current = null
		}
	})
}
