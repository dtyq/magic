import { Check, X } from "lucide-react"
import type { MagicClawItem } from "@/apis"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { getMagiClawDisplayName } from "./useMagiClawMobilePage"

interface MagiClawDeleteConfirmSheetProps {
	open: boolean
	claw: MagicClawItem | null
	clawBrandValues: Record<string, unknown>
	t: (key: string, values?: Record<string, unknown>) => string
	onClose: () => void
	onConfirm: () => void
}

/**
 * MagiClawDeleteConfirmSheet 复刻原型的底部删除确认层，替代旧 confirm dialog。
 */
export function MagiClawDeleteConfirmSheet({
	open,
	claw,
	clawBrandValues,
	t,
	onClose,
	onConfirm,
}: MagiClawDeleteConfirmSheetProps) {
	const displayName = claw ? getMagiClawDisplayName(claw, t, clawBrandValues) : ""

	return (
		<Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-auto flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="magi-claw-delete-confirm-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
				</div>

				<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					<button
						type="button"
						onClick={onClose}
						className="absolute left-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("common.cancel")}
						data-testid="magi-claw-delete-confirm-cancel"
					>
						<X className="size-[22px] text-foreground" />
					</button>
					<SheetTitle className="max-w-[247px] truncate text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
						{t("superLobster.created.delete")}
					</SheetTitle>
					<button
						type="button"
						onClick={onConfirm}
						className="absolute right-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-destructive shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("superLobster.created.delete", clawBrandValues)}
						data-testid="magi-claw-delete-confirm-submit"
					>
						<Check className="size-[22px] text-white" strokeWidth={2.5} />
					</button>
				</div>

				<div
					className="flex flex-col items-center px-4 pt-2"
					style={{ paddingBottom: "calc(var(--safe-area-inset-bottom) + 24px)" }}
					data-testid="magi-claw-delete-confirm-body"
				>
					<p
						className="text-center text-[16px] leading-6 text-foreground"
						data-testid="magi-claw-delete-confirm-description"
					>
						{t("superLobster.created.deleteConfirmTitle", {
							...clawBrandValues,
							name: displayName,
						})}
					</p>
					<p className="mt-2 text-center text-[14px] leading-5 text-muted-foreground">
						{t("superLobster.created.deleteConfirmDescription", clawBrandValues)}
					</p>
				</div>
			</SheetContent>
		</Sheet>
	)
}
