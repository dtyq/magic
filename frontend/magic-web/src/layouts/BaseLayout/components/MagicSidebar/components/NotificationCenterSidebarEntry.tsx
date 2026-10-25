import { observer } from "mobx-react-lite"
import { Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagicTooltip } from "@/components/base"
import NotificationUnreadBadge from "@/components/business/NotificationCenter/NotificationUnreadBadge"
import {
	notificationCenterStore,
	openNotificationCenter,
} from "@/components/business/NotificationCenter/store"
import { Button } from "@/components/shadcn-ui/button"
import { useNotificationCenterBootstrap } from "@/components/business/NotificationCenter/useNotificationCenterBootstrap"

interface NotificationCenterSidebarEntryProps {
	collapsed: boolean
}

const NotificationCenterSidebarEntry = observer(function NotificationCenterSidebarEntry({
	collapsed,
}: NotificationCenterSidebarEntryProps) {
	const { t } = useTranslation("sidebar")
	useNotificationCenterBootstrap()
	const label = t("footer.inbox")

	return (
		<MagicTooltip
			title={label}
			placement={collapsed ? "right" : "top"}
			disabled={notificationCenterStore.visible}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label={label}
				data-testid="inbox-sidebar-entry"
				className="relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground"
				onClick={openNotificationCenter}
			>
				<Mail className="size-4" />
				<NotificationUnreadBadge
					label={notificationCenterStore.unreadTotalLabel}
					testId="inbox-sidebar-badge"
					className="pointer-events-none absolute -right-1.5 -top-1.5 h-4 min-w-4 border-2 border-sidebar px-1 text-[10px] font-semibold"
				/>
			</Button>
		</MagicTooltip>
	)
})

export default NotificationCenterSidebarEntry
