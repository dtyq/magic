import { Building2, Check, X } from "lucide-react"
import { useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { resolvePublisherLabel } from "@/pages/superMagic/pages/CrewMarket/employee-market/components/employee-card-shared"
import MyCrewAvatar from "./MyCrewAvatar"

/** Minimal agent fields needed to render the dismiss confirmation crew card. */
export interface DismissCrewConfirmTarget {
	agentCode: string
	name: string | null
	icon: string | null
	publisherType?: string | null
	publisherName?: string | null
}

interface DismissCrewConfirmSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	target: DismissCrewConfirmTarget | null
	onConfirm: () => void
}

/** Prototype-aligned bottom sheet for confirming dismissal of a market-installed crew member. */
export default function DismissCrewConfirmSheet({
	open,
	onOpenChange,
	target,
	onConfirm,
}: DismissCrewConfirmSheetProps) {
	const { t } = useTranslation("crew/market")
	const lastTargetRef = useRef<DismissCrewConfirmTarget | null>(null)

	if (target) {
		lastTargetRef.current = target
	}

	const displayTarget = target ?? lastTargetRef.current

	const displayName = useMemo(() => {
		if (!displayTarget) return ""
		return (
			displayTarget.name?.trim() || t("crew/create:untitledCrew") || displayTarget.agentCode
		)
	}, [displayTarget, t])

	const publisherLabel = useMemo(() => {
		if (!displayTarget) return ""
		return resolvePublisherLabel(
			displayTarget.publisherType ?? "",
			displayTarget.publisherName,
			t,
		)
	}, [displayTarget, t])

	function handleClose() {
		onOpenChange(false)
	}

	function handleConfirm() {
		onConfirm()
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="z-[60] flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="crew-dismiss-confirm-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground" aria-hidden />
				</div>

				<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					<button
						type="button"
						onClick={handleClose}
						className="absolute left-[10px] top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("myCrewPage.dismissSheet.cancelAria")}
						data-testid="crew-dismiss-confirm-cancel"
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</button>

					<SheetTitle className="max-w-[247px] truncate text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
						{t("myCrewPage.dismissSheet.title")}
					</SheetTitle>

					<button
						type="button"
						onClick={handleConfirm}
						className="absolute right-[10px] top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-destructive shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-80"
						aria-label={t("myCrewPage.dismissSheet.confirmAria")}
						data-testid="crew-dismiss-confirm-submit"
					>
						<Check className="h-[22px] w-[22px] text-white" strokeWidth={2.5} />
					</button>
				</div>

				<div
					className="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[10px] pt-2"
					style={{ paddingBottom: "max(var(--safe-area-inset-bottom), 16px)" }}
				>
					<div className="flex flex-col gap-2">
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("myCrewPage.dismissSheet.crewLabel")}
						</p>
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							<div className="flex h-16 items-center gap-3 px-[14px]">
								{displayTarget ? (
									<div
										className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-background shadow-[0px_4px_12px_0px_rgba(0,0,0,0.12)]"
										data-testid="crew-dismiss-confirm-avatar"
									>
										<MyCrewAvatar
											employee={displayTarget}
											sizeClassName="h-full w-full"
											fallbackTextClassName="text-[16px] font-semibold text-white"
											className="h-full w-full overflow-hidden rounded-full"
										/>
									</div>
								) : null}
								<div className="flex min-w-0 flex-1 flex-col justify-center">
									<span
										className="truncate text-[16px] font-medium leading-5 text-foreground"
										data-testid="crew-dismiss-confirm-name"
									>
										{displayName || "—"}
									</span>
									<div className="mt-0.5 flex min-w-0 items-center gap-1">
										<Building2
											className="h-3 w-3 shrink-0 text-muted-foreground"
											strokeWidth={2}
											aria-hidden
										/>
										<span
											className="truncate text-[13px] leading-4 text-muted-foreground"
											data-testid="crew-dismiss-confirm-publisher"
										>
											{publisherLabel || "—"}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{displayTarget ? (
						<p
							className="px-[14px] pt-1 text-[14px] leading-5 text-muted-foreground"
							data-testid="crew-dismiss-confirm-description"
						>
							{t("myCrewPage.dismissSheet.description", { name: displayName })}
						</p>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	)
}
