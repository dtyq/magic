import { ArrowRight, Store, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"

interface MyCrewAddSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onOpenMarket: () => void
}

/** 新增员工入口，使用 MagicPopup 承载，只保留员工市场入口。 */
export default function MyCrewAddSheet({
	open,
	onOpenChange,
	onOpenMarket,
}: MyCrewAddSheetProps) {
	const { t } = useTranslation("crew/market")

	function handleOpenMarket() {
		onOpenChange(false)
		onOpenMarket()
	}

	return (
		<MagicPopup
			visible={open}
			onClose={() => onOpenChange(false)}
			headerVariant="actionHeader"
			headerTitle={t("myCrewPage.addSheet.title")}
			headerLeadingAction={{
				icon: <X className="h-[22px] w-[22px]" />,
				ariaLabel: t("myCrewPage.addSheet.closeAria"),
				onClick: () => onOpenChange(false),
				testId: "my-crew-add-sheet-close",
			}}
			title={t("myCrewPage.addSheet.title")}
			bodyClassName="px-4 pb-4 pt-2"
			data-testid="my-crew-add-sheet"
		>
			<button
				type="button"
				onClick={handleOpenMarket}
				className="flex w-full flex-col gap-4 rounded-2xl bg-card p-5 text-left transition-opacity active:opacity-75"
				style={{ boxShadow: "0px 2px 16px 0px rgba(0,0,0,0.07)" }}
				data-testid="my-crew-add-sheet-market"
			>
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10">
					<Store className="h-6 w-6 text-indigo-500" strokeWidth={1.75} />
				</div>
				<div className="flex flex-col gap-1.5">
					<p className="text-[17px] font-semibold leading-tight text-foreground">
						{t("myCrewPage.addSheet.market.title")}
					</p>
					<p className="text-[13px] leading-[1.55] text-muted-foreground">
						{t("myCrewPage.addSheet.market.description")}
					</p>
				</div>
				<div className="mt-auto flex items-center gap-1">
					<span className="text-[13px] font-semibold leading-none text-primary">
						{t("myCrewPage.addSheet.market.action")}
					</span>
					<ArrowRight className="h-[14px] w-[14px] text-primary" strokeWidth={2.5} />
				</div>
			</button>
		</MagicPopup>
	)
}
