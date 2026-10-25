import { comparer, reaction } from "mobx"
import chatWebSocket from "@/apis/clients/chatWebSocket"
import type { NotificationUpdate } from "@/apis/modules/notifications"
import { userStore } from "@/models/user"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { notificationCenterStore } from "./store"

let consumers = 0
let dispose: (() => void) | undefined

/** Desktop and mobile entries share one subscription and one reconciliation owner. */
export function acquireNotificationCenterRealtime() {
	consumers += 1
	if (consumers === 1) {
		const hasScope = () => {
			const { authorization, userInfo, organizationCode } = userStore.user
			return Boolean(authorization && userInfo?.user_id && organizationCode)
		}
		const reconcile = () => {
			if (hasScope()) void notificationCenterStore.reconcile()
		}
		const handleUpdate = (update: NotificationUpdate) => {
			if (!hasScope() || update.organization_code !== userStore.user.organizationCode) return
			notificationCenterStore.setCounts(update.counts)
			void notificationCenterStore.reloadList()
		}
		const handleVisibility = () => {
			if (document.visibilityState === "visible") reconcile()
		}
		// Scope changes invalidate in-flight reads before loading data for the new identity.
		const stopScope = reaction(
			() => [
				userStore.user.authorization,
				userStore.user.userInfo?.user_id,
				userStore.user.organizationCode,
			],
			() => {
				notificationCenterStore.clearUserCache()
				reconcile()
			},
			{ fireImmediately: true, equals: comparer.structural },
		)
		pubsub.subscribe(PubSubEvents.Notification_Updated, handleUpdate)
		chatWebSocket.on("open", reconcile)
		document.addEventListener("visibilitychange", handleVisibility)
		window.addEventListener("pageshow", reconcile)
		window.addEventListener("online", reconcile)
		dispose = () => {
			stopScope()
			pubsub.unsubscribe(PubSubEvents.Notification_Updated, handleUpdate)
			chatWebSocket.off("open", reconcile)
			document.removeEventListener("visibilitychange", handleVisibility)
			window.removeEventListener("pageshow", reconcile)
			window.removeEventListener("online", reconcile)
			notificationCenterStore.clearUserCache()
		}
	}
	let released = false
	return () => {
		if (released) return
		released = true
		consumers -= 1
		if (consumers === 0) {
			dispose?.()
			dispose = undefined
		}
	}
}
