import { observer } from "mobx-react-lite"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { mobileTabStore } from "@/stores/mobileTab"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Button } from "@/components/shadcn-ui/button"
import { WorkspaceSection } from "@/pages/superMagicMobile/pages/navigate/components"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"

function NavigatePopup() {
	const { t } = useTranslation("super")
	const { t: tInterface } = useTranslation("interface")

	const handleClose = useMemoizedFn(() => {
		mobileTabStore.closeNavigatePopup()
	})

	return (
		<MagicPopup
			visible={mobileTabStore.navigatePopupVisible}
			onClose={handleClose}
			onMaskClick={handleClose}
			position="bottom"
			bodyClassName="flex min-h-[60vh] max-h-[80vh] flex-col"
			destroyOnClose={false}
			getContainer={() => document.body}
			stopPropagation={["click"]}
		>
			<div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
				<div className="text-base font-semibold leading-6 text-foreground">
					{t("mobile.navigate.title")}
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					className="rounded-sm text-foreground/80 active:bg-card"
					aria-label={tInterface("button.close")}
					onClick={handleClose}
				>
					<MagicIcon component={IconX} size={24} />
				</Button>
			</div>
			{/* Keep the header fixed while the navigation content scrolls inside the popup. */}
			<ScrollArea className="min-h-0 flex-1 bg-background" viewportClassName="px-2 py-2.5">
				<div className="flex flex-col gap-5">
					<WorkspaceSection toWorkspace={handleClose} />
				</div>
			</ScrollArea>
		</MagicPopup>
	)
}

export default observer(NavigatePopup)
