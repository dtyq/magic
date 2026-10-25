import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { cn } from "@/utils/cn"
import NotificationUnreadBadge from "./NotificationUnreadBadge"
import { notificationCenterStore } from "./store"
import type { NotificationTab } from "./types"

const TAB_TRIGGER_CLASS =
	"relative h-12 flex-none rounded-none border-0 px-0 text-sm font-normal text-muted-foreground shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full dark:text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-primary dark:data-[state=active]:bg-transparent"

const NotificationTabs = observer(function NotificationTabs({
	mobile = false,
}: {
	mobile?: boolean
}) {
	const { t } = useTranslation("sidebar")

	return (
		<Tabs
			value={notificationCenterStore.activeTab}
			onValueChange={(nextValue) => {
				if (nextValue === "all" || nextValue === "system" || nextValue === "auth") {
					void notificationCenterStore.setActiveTab(nextValue)
				}
			}}
			className={cn("min-w-0 border-b border-border", mobile ? "px-3" : "px-[22px]")}
		>
			<TabsList
				className={cn(
					"h-auto w-full justify-start rounded-none bg-transparent p-0",
					mobile ? "grid grid-cols-3" : "gap-[26px]",
				)}
				aria-label={t("inbox.tabsAria")}
			>
				<TabsTrigger
					value={"all" satisfies NotificationTab}
					className={cn(TAB_TRIGGER_CLASS, mobile && "text-sm after:inset-x-1/4")}
					data-testid="inbox-tab-all"
					onClick={() => {
						void notificationCenterStore.setActiveTab("all")
					}}
				>
					{t("inbox.tabs.all")}
				</TabsTrigger>
				<TabsTrigger
					value={"system" satisfies NotificationTab}
					className={cn(
						TAB_TRIGGER_CLASS,
						"gap-[5px]",
						mobile && "text-sm after:inset-x-1/4",
					)}
					data-testid="inbox-tab-system"
					onClick={() => {
						void notificationCenterStore.setActiveTab("system")
					}}
				>
					{t("inbox.tabs.system")}
					<NotificationUnreadBadge
						label={notificationCenterStore.unreadSystemLabel}
						variant="system"
						testId="inbox-tab-system-badge"
					/>
				</TabsTrigger>
				<TabsTrigger
					value={"auth" satisfies NotificationTab}
					className={cn(
						TAB_TRIGGER_CLASS,
						"gap-[5px]",
						mobile && "text-sm after:inset-x-1/4",
					)}
					data-testid="inbox-tab-auth"
					onClick={() => {
						void notificationCenterStore.setActiveTab("auth")
					}}
				>
					{t("inbox.tabs.auth")}
					<NotificationUnreadBadge
						label={notificationCenterStore.unreadAuthLabel}
						variant="auth"
						testId="inbox-tab-auth-badge"
					/>
				</TabsTrigger>
			</TabsList>
		</Tabs>
	)
})

export default NotificationTabs
