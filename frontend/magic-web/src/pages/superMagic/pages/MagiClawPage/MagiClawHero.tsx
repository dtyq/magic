import { useTranslation } from "react-i18next"
import heroBackground from "@/assets/resources/magi-claw/hero-background.webp"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

export function MagiClawHero() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	return (
		<section
			className="relative h-[220px] overflow-hidden rounded-[32px]"
			style={{
				backgroundImage: `url(${heroBackground})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
			}}
			data-testid="magi-claw-hero"
		>
			<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-center">
				<h1 className="flex items-center gap-0.5 whitespace-nowrap font-poppins text-[36px] leading-none tracking-[-0.72px] text-foreground">
					<span className="font-semibold">
						{t("superLobster.heroLead", clawBrandValues)}
					</span>
					<span className="font-black text-[#EF4444]">
						{t("superLobster.titleAccent", clawBrandValues)}
					</span>
				</h1>
				<p className="font-['Geist'] text-base leading-6 text-muted-foreground">
					{t("superLobster.description", clawBrandValues)}
				</p>
			</div>
		</section>
	)
}
