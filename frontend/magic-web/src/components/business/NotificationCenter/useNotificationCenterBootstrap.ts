import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { notificationCenterStore } from "./store"
import { acquireNotificationCenterRealtime } from "./realtime"

/** Prefetch counts for the sidebar badge, and reload templates when the UI language changes. */
export function useNotificationCenterBootstrap() {
	const { i18n } = useTranslation()

	useEffect(acquireNotificationCenterRealtime, [])

	useEffect(() => {
		void notificationCenterStore.loadTemplates(i18n.language)
	}, [i18n.language])
}
