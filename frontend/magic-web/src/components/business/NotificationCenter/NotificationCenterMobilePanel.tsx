import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import magicToast from "@/components/base/MagicToaster/utils"
import NotificationList from "./NotificationList"
import NotificationTabs from "./NotificationTabs"
import { notificationCenterStore } from "./store"

const NotificationCenterMobilePanel = observer(function NotificationCenterMobilePanel() {
	const { t, i18n } = useTranslation("sidebar")
	useEffect(() => {
		void notificationCenterStore.loadTemplates(i18n.language)
	}, [i18n.language])

	async function handleMarkAllRead() {
		await notificationCenterStore.markAllSystemRead()
		magicToast.info(t("inbox.toast.markAllRead"))
	}

	return (
		<Sheet
			open={notificationCenterStore.visible}
			onOpenChange={(open) => {
				if (!open) notificationCenterStore.close()
			}}
		>
			<SheetContent
				side="right"
				showClose={false}
				aria-describedby={undefined}
				className="inset-0 h-full w-full max-w-none gap-0 border-0 p-0 sm:max-w-none"
				data-testid="inbox-mobile-panel"
			>
				<SheetTitle className="sr-only">{t("footer.inbox")}</SheetTitle>
				<header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-9"
						aria-label={t("inbox.back")}
						data-testid="inbox-back"
						onClick={() => notificationCenterStore.close()}
					>
						<ChevronLeft className="size-4" />
					</Button>
					<h1 className="text-base font-medium">{t("footer.inbox")}</h1>
					<Button
						variant="ghost"
						size="sm"
						data-testid="inbox-mark-all-read"
						onClick={() => {
							void handleMarkAllRead()
						}}
					>
						{t("inbox.markAllRead")}
					</Button>
				</header>
				<NotificationTabs mobile />
				<NotificationList mobile />
			</SheetContent>
		</Sheet>
	)
})

export default NotificationCenterMobilePanel
