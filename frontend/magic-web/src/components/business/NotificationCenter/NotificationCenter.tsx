import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import NotificationCenterMobilePanel from "./NotificationCenterMobilePanel"
import NotificationCenterPanel from "./NotificationCenterPanel"

const NotificationCenter = observer(function NotificationCenter() {
	const isMobile = useIsMobile()
	return isMobile ? <NotificationCenterMobilePanel /> : <NotificationCenterPanel />
})

export default NotificationCenter
