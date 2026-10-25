import { useTranslation } from "react-i18next"
import clawLogo from "@/assets/resources/magi-claw/claw-logo.svg"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

export function MagiClawHero() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const title = t("superLobster.title", clawBrandValues)

	return (
		<section
			className="relative isolate flex min-h-[280px] flex-col items-center justify-center gap-8 overflow-hidden rounded-[24px] bg-gradient-to-b from-rose-50/80 via-rose-50/35 to-transparent px-4 py-10 text-center dark:from-red-950/20 dark:via-red-950/10 dark:to-transparent"
			data-testid="magi-claw-hero"
			data-guide-anchor="magi-claw-hero"
		>
			{/* Corner dot fields echo the brand mark and fade toward the center of the Hero. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute left-6 top-6 size-36 text-rose-400/25 dark:text-red-300/20"
				style={{
					backgroundImage:
						"radial-gradient(circle, currentColor 1.5px, transparent 1.5px)",
					backgroundSize: "12px 12px",
					maskImage: "linear-gradient(to bottom right, black 0%, transparent 78%)",
					WebkitMaskImage: "linear-gradient(to bottom right, black 0%, transparent 78%)",
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute bottom-6 right-6 size-36 text-indigo-300/30 dark:text-indigo-200/20"
				style={{
					backgroundImage:
						"radial-gradient(circle, currentColor 1.5px, transparent 1.5px)",
					backgroundSize: "12px 12px",
					maskImage: "linear-gradient(to top left, black 0%, transparent 78%)",
					WebkitMaskImage: "linear-gradient(to top left, black 0%, transparent 78%)",
				}}
			/>
			<img className="relative z-10 size-[120px]" src={clawLogo} alt={title} />
			<div className="relative z-10 flex max-w-[640px] flex-col gap-4">
				<h1 className="font-poppins text-3xl font-semibold leading-none text-foreground">
					{title}
				</h1>
				<p className="whitespace-pre-line font-['Geist'] text-base leading-6 text-muted-foreground">
					{t("superLobster.heroDescription", clawBrandValues)}
				</p>
			</div>
		</section>
	)
}
