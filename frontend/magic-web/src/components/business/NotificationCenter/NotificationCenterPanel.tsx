import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import magicToast from "@/components/base/MagicToaster/utils"
import NotificationList from "./NotificationList"
import NotificationTabs from "./NotificationTabs"
import { notificationCenterStore } from "./store"

const NotificationCenterPanel = observer(function NotificationCenterPanel() {
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
				className="w-[min(520px,100vw)] gap-0 p-0 sm:max-w-[520px]"
				data-testid="inbox-panel"
			>
				<SheetTitle className="sr-only">{t("footer.inbox")}</SheetTitle>
				<header className="flex shrink-0 items-center justify-between gap-3 px-[22px] pb-3.5 pt-[22px]">
					<h2 className="text-lg font-medium text-foreground">{t("footer.inbox")}</h2>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="px-2 text-sm font-normal text-muted-foreground"
							data-testid="inbox-mark-all-read"
							onClick={() => {
								void handleMarkAllRead()
							}}
						>
							{t("inbox.markAllRead")}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							aria-label={t("inbox.close")}
							data-testid="inbox-close"
							onClick={() => notificationCenterStore.close()}
						>
							<X className="size-4" />
						</Button>
					</div>
				</header>
				<NotificationTabs />
				<NotificationList />
			</SheetContent>
		</Sheet>
	)
})

export default NotificationCenterPanel
