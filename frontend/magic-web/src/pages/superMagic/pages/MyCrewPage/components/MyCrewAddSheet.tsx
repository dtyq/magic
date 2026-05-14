import { ArrowRight, Sparkles, Store, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"

interface MyCrewAddSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onOpenMarket: () => void
	onCreateCustom: () => void
}

/** 卡片式分流项统一封装，避免“市场 / 自建”入口的视觉和交互分裂。 */
function OptionCard(props: {
	title: string
	description: string
	actionLabel: string
	icon: React.ReactNode
	iconBlockClassName: string
	onClick: () => void
	dataTestId: string
}) {
	const { title, description, actionLabel, icon, iconBlockClassName, onClick, dataTestId } = props

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full flex-col gap-4 rounded-2xl bg-card p-5 text-left transition-opacity active:opacity-75"
			style={{ boxShadow: "0px 2px 16px 0px rgba(0,0,0,0.07)" }}
			data-testid={dataTestId}
		>
			<div
				className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBlockClassName}`}
			>
				{icon}
			</div>
			<div className="flex flex-col gap-1.5">
				<p className="text-[17px] font-semibold leading-tight text-foreground">{title}</p>
				<p className="text-[13px] leading-[1.55] text-muted-foreground">{description}</p>
			</div>
			<div className="mt-auto flex items-center gap-1">
				<span className="text-[13px] font-semibold leading-none text-primary">
					{actionLabel}
				</span>
				<ArrowRight className="h-[14px] w-[14px] text-primary" strokeWidth={2.5} />
			</div>
		</button>
	)
}

/** 新增员工入口先还原原型的分流结构，但具体动作继续遵守主仓的产品降级约束。 */
export default function MyCrewAddSheet({
	open,
	onOpenChange,
	onOpenMarket,
	onCreateCustom,
}: MyCrewAddSheetProps) {
	const { t } = useTranslation("crew/market")

	// 市场入口属于现有真实能力，点击后先关闭 sheet 再跳转，避免壳层动画重叠。
	function handleOpenMarket() {
		onOpenChange(false)
		onOpenMarket()
	}

	// 自建入口当前仍是产品降级项，保留原型分流 UI，但动作落到 PC only 提示。
	function handleCreateCustom() {
		onOpenChange(false)
		onCreateCustom()
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="my-crew-add-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground" aria-hidden />
				</div>

				<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="absolute left-[10px] top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("myCrewPage.addSheet.closeAria")}
						data-testid="my-crew-add-sheet-close"
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</Button>
					<SheetTitle className="font-poppins text-[18px] font-medium leading-6 text-foreground">
						{t("myCrewPage.addSheet.title")}
					</SheetTitle>
				</div>

				<div className="flex flex-col gap-3 px-4 pb-4 pt-2">
					<OptionCard
						title={t("myCrewPage.addSheet.market.title")}
						description={t("myCrewPage.addSheet.market.description")}
						actionLabel={t("myCrewPage.addSheet.market.action")}
						icon={<Store className="h-6 w-6 text-indigo-500" strokeWidth={1.75} />}
						iconBlockClassName="bg-indigo-500/10"
						onClick={handleOpenMarket}
						dataTestId="my-crew-add-sheet-market"
					/>
					<OptionCard
						title={t("myCrewPage.addSheet.custom.title")}
						description={t("myCrewPage.addSheet.custom.description")}
						actionLabel={t("myCrewPage.addSheet.custom.action")}
						icon={<Sparkles className="h-6 w-6 text-amber-500" strokeWidth={1.75} />}
						iconBlockClassName="bg-amber-500/10"
						onClick={handleCreateCustom}
						dataTestId="my-crew-add-sheet-custom"
					/>
				</div>
			</SheetContent>
		</Sheet>
	)
}
