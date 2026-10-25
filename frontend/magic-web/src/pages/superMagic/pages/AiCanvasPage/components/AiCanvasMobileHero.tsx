import { memo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Trans, useTranslation } from "react-i18next"
import type { ShowcaseKind } from "../showcase"
import { ArtworkImage, ScribbleCircle, assignBoardSlots, type BoardArtwork } from "./AiCanvasHero"

/** Spots of the three showcase cards, fanned slightly like prints on a table. */
const CARD_LAYOUT: Array<{ kind: ShowcaseKind; rotate: number; className: string }> = [
	{ kind: "poster", rotate: -7, className: "aspect-[3/4] w-[68px]" },
	{ kind: "character", rotate: 0, className: "z-10 aspect-[3/4] w-[76px]" },
	{ kind: "product", rotate: 7, className: "aspect-square w-[64px]" },
]

/**
 * Compact first screen of the H5 AI canvas home: the desktop hero's title (with its hand-drawn
 * circle) and subtitle over the same dotted board, and three showcase prints instead of the
 * animated board. Kept around 210px tall so "My canvases" stays in view above the docked
 * composer; it scrolls away with the list. The prints float gently unless reduced motion is on.
 */
function AiCanvasMobileHero({ artworks }: { artworks: BoardArtwork[] }) {
	const { t } = useTranslation("aiCanvas")
	const animated = !useReducedMotion()
	const slots = assignBoardSlots(artworks)
	const artworkByKind: Partial<Record<ShowcaseKind, BoardArtwork | undefined>> = {
		poster: slots.poster,
		character: slots.character,
		product: slots.products[0],
	}

	return (
		<section
			className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-background px-4 pb-4 pt-5"
			data-testid="ai-canvas-mobile-hero"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					backgroundImage: [
						"radial-gradient(oklch(var(--foreground) / 0.14) 1px, transparent 1.2px)",
						"radial-gradient(18rem 10rem at 12% 10%, rgb(196 181 253 / 0.22), transparent 70%)",
						"radial-gradient(18rem 10rem at 90% 90%, rgb(253 224 171 / 0.26), transparent 70%)",
					].join(", "),
					backgroundSize: "18px 18px, 100% 100%, 100% 100%",
				}}
			/>
			<h1 className="text-center text-[22px] font-semibold leading-8 tracking-tight text-foreground">
				<Trans t={t} i18nKey="home.heroTitle" components={{ circle: <ScribbleCircle /> }} />
			</h1>
			<p className="mx-auto mt-1 line-clamp-2 max-w-[300px] text-center text-xs leading-5 text-muted-foreground">
				{t("home.subtitle")}
			</p>
			<div className="mt-3 flex items-end justify-center" aria-hidden="true">
				{CARD_LAYOUT.map(({ kind, rotate, className }, index) => (
					<motion.div
						key={kind}
						className={`-mx-1.5 overflow-hidden bg-background p-[3px] shadow-[0_10px_24px_-14px_rgb(15_23_42/0.45)] ring-1 ring-border ${className}`}
						initial={false}
						animate={animated ? { y: [0, -3, 0], rotate } : { y: 0, rotate }}
						transition={
							animated
								? {
										y: {
											duration: 5,
											ease: "easeInOut",
											repeat: Infinity,
											delay: index * 0.8,
										},
										rotate: { duration: 0 },
									}
								: { duration: 0 }
						}
					>
						<div className="size-full overflow-hidden">
							<ArtworkImage artwork={artworkByKind[kind]} kind={kind} />
						</div>
					</motion.div>
				))}
			</div>
		</section>
	)
}

export default memo(AiCanvasMobileHero)
