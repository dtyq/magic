import { useEffect } from "react"
import { observer } from "mobx-react-lite"
import NotificationCenterMobilePanel from "./NotificationCenterMobilePanel"
import { notificationCenterStore } from "./store"

interface NotificationCenterMobileMountProps {
	onOpen?: () => void
}

/** Closes the mobile shell sidebar when the inbox overlay opens, without coupling panel UI to the layout store. */
const NotificationCenterMobileMount = observer(function NotificationCenterMobileMount({
	onOpen,
}: NotificationCenterMobileMountProps) {
	useEffect(() => {
		if (notificationCenterStore.visible) onOpen?.()
	}, [notificationCenterStore.visible, onOpen])

	return <NotificationCenterMobilePanel />
})

export default NotificationCenterMobileMount
