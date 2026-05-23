import { Ellipsis, ChevronLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawItem } from "@/apis"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface ClawMobileHeaderProps {
	magicClaw: MagicClawItem | null
	onBack: () => void
	onOpenMoreSheet: () => void
}

export function ClawMobileHeader({ magicClaw, onBack, onOpenMoreSheet }: ClawMobileHeaderProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	return (
		<header
			className="mobile-floating-page-header relative z-[25] flex h-14 shrink-0 items-center gap-2 rounded-b-2xl bg-transparent px-3"
			data-testid="claw-mobile-header"
		>
			<button
				type="button"
				className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card shadow-sm"
				data-testid="claw-mobile-back-button"
				onClick={onBack}
			>
				<ChevronLeft className="size-6 text-foreground" />
			</button>

			<div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
				<p className="w-full truncate text-center text-lg font-medium leading-6 text-foreground">
					{magicClaw?.name ||
						t("superLobster.workspace.untitledProject", clawBrandValues)}
				</p>
				<p className="w-full truncate text-center text-xs leading-4 text-muted-foreground">
					{t("superLobster.title", clawBrandValues) || "MagiClaw"}
				</p>
			</div>

			<div className="flex h-12 shrink-0 items-center rounded-full bg-card shadow-sm">
				<button
					type="button"
					className="flex size-12 items-center justify-center rounded-full"
					data-testid="claw-mobile-more-button"
					onClick={onOpenMoreSheet}
				>
					<Ellipsis className="size-6 text-foreground" />
				</button>
			</div>
		</header>
	)
}
