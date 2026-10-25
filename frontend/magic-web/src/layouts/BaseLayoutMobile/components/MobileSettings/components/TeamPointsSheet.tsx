import { Sparkles } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { MobileSettingsSheetContainer } from "./SheetContainer"
import { getMobileSettingsPointsOverview } from "../utils"

/** Show the shared team balance and explain that team members cannot recharge it themselves. */
export const MobileSettingsTeamPointsSheet = observer(
	function MobileSettingsTeamPointsSheet(props: { open: boolean; onClose: () => void }) {
		const { open, onClose } = props
		const { t } = useTranslation("interface")
		const overview = getMobileSettingsPointsOverview()
		const pointsValue =
			overview.primaryPoints == null
				? "--"
				: new Intl.NumberFormat().format(overview.primaryPoints)

		return (
			<MobileSettingsSheetContainer
				open={open}
				title={t("setting.teamPointsSheet.title")}
				sheetClassName="rounded-t-[14px] border-0 bg-muted p-0"
				contentClassName="px-[14px] pb-[calc(var(--safe-area-inset-bottom)+20px)] pt-2"
				onOpenChange={(nextOpen) => {
					if (!nextOpen) onClose()
				}}
				dataTestId="mobile-settings-team-points-sheet"
			>
				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5">
					<div className="flex flex-col items-center gap-3 pt-2">
						<div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]">
							<Sparkles className="size-8 text-foreground" />
						</div>
						<div className="flex flex-col items-center gap-1">
							<p className="text-[13px] leading-4 text-muted-foreground">
								{t("setting.teamPointsSheet.balanceLabel")}
							</p>
							<p className="text-[42px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
								{pointsValue}
							</p>
						</div>
					</div>
					<p className="px-1 text-center text-[14px] leading-5 text-muted-foreground">
						{t("setting.teamPointsSheet.hint")}
					</p>
					<button
						type="button"
						onClick={onClose}
						className="h-12 w-full shrink-0 rounded-xl bg-primary text-[16px] font-medium text-primary-foreground transition-opacity active:opacity-90"
						data-testid="mobile-settings-team-points-confirm"
					>
						{t("setting.teamPointsSheet.cta")}
					</button>
				</div>
			</MobileSettingsSheetContainer>
		)
	},
)
