import { observer } from "mobx-react-lite"
import { MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import NotificationUnreadBadge from "@/components/business/NotificationCenter/NotificationUnreadBadge"
import {
	notificationCenterStore,
	openNotificationCenter,
} from "@/components/business/NotificationCenter/store"
import { useNotificationCenterBootstrap } from "@/components/business/NotificationCenter/useNotificationCenterBootstrap"
import { cn } from "@/utils/cn"

interface NotificationCenterMobileSidebarEntryProps {
	testIdPrefix: string
	rowClassName: string
}

const NotificationCenterMobileSidebarEntry = observer(
	function NotificationCenterMobileSidebarEntry({
		testIdPrefix,
		rowClassName,
	}: NotificationCenterMobileSidebarEntryProps) {
		const { t } = useTranslation("sidebar")
		useNotificationCenterBootstrap()

		return (
			<button
				type="button"
				onClick={openNotificationCenter}
				data-testid={`${testIdPrefix}-nav-inbox`}
				className={cn(rowClassName, "justify-between")}
			>
				<span className="flex min-w-0 items-center gap-2">
					<MessageSquare className="size-4 shrink-0 text-foreground" aria-hidden />
					<span className="leading-6">{t("footer.inbox")}</span>
				</span>
				<NotificationUnreadBadge
					label={notificationCenterStore.unreadTotalLabel}
					className="h-5 bg-[#ff3b30] px-[7px]"
					testId="inbox-mobile-entry-badge"
				/>
			</button>
		)
	},
)

export default NotificationCenterMobileSidebarEntry
