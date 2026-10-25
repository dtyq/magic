import {
	Fragment,
	memo,
	useEffect,
	useId,
	useState,
	type ComponentType,
	type PointerEvent,
	type ReactNode,
} from "react"
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
	type MotionValue,
	type Transition,
} from "framer-motion"
import { Trans, useTranslation } from "react-i18next"
import {
	Check,
	Clapperboard,
	Crop,
	Download,
	Eraser,
	Expand,
	Hd,
	Play,
	RefreshCw,
	Sparkles,
	Wand2,
	type LucideProps,
} from "lucide-react"
import { cn } from "@/utils/cn"
import type { ShowcaseKind } from "../showcase"
import { buildTaperedOutline, scribbleToPathData, type Scribble } from "../utils/scribblePath"
import AiCanvasComposerFrame from "./AiCanvasComposerFrame"
import ArtworkPlaceholder from "./ArtworkPlaceholder"

/** One built-in artwork placed on the hero board. */
export interface BoardArtwork {
	key: string
	kind: ShowcaseKind
	url: string
	/** The artwork after the board note's edit; enables the in-place edit animation. */
	editedUrl?: string
}

interface AiCanvasHeroProps {
	/** Built-in showcase artworks; empty slots fall back to vector placeholders. */
	artworks: BoardArtwork[]
	children: ReactNode
	footer?: ReactNode
}

export function ArtworkImage({ artwork, kind }: { artwork?: BoardArtwork; kind: ShowcaseKind }) {
	const fallback = <ArtworkPlaceholder kind={kind} className="size-full" />
	if (artwork?.url) {
		return <img src={artwork.url} alt="" draggable={false} className="size-full object-cover" />
	}
	return fallback
}

/**
 * Demo loop of the annotation edit on the character card:
 * | phase   | duration | what the board shows                                       |
 * | before  | 2.8s     | original artwork                                           |
 * | editing | 1.8s     | flowing connector, selection box, edited image wipes in    |
 * | after   | 3.4s     | edited artwork with a "done" tag, then fades back to before |
 */
export type EditPhase = "before" | "editing" | "after"

const EDIT_PHASE_DURATIONS: Record<EditPhase, number> = {
	before: 2800,
	editing: 1800,
	after: 3400,
}
const NEXT_EDIT_PHASE: Record<EditPhase, EditPhase> = {
	before: "editing",
	editing: "after",
	after: "before",
}

/** Tracks tab visibility so timer-driven board loops stop scheduling in background tabs. */
function usePageVisible() {
	const [visible, setVisible] = useState(
		() => typeof document === "undefined" || document.visibilityState === "visible",
	)
	useEffect(() => {
		const handleVisibility = () => setVisible(document.visibilityState === "visible")
		document.addEventListener("visibilitychange", handleVisibility)
		return () => document.removeEventListener("visibilitychange", handleVisibility)
	}, [])
	return visible
}

/**
 * Runs the edit demo loop. It stays on "before" when disabled (reduced motion or no edited
 * artwork) and pauses while the tab is hidden, so a background tab schedules no timers.
 */
function useEditPhase(enabled: boolean): EditPhase {
	const [phase, setPhase] = useState<EditPhase>("before")
	const visible = usePageVisible()

	useEffect(() => {
		if (!enabled) {
			setPhase("before")
			return
		}
		if (!visible) return
		const timer = window.setTimeout(
			() => setPhase((current) => NEXT_EDIT_PHASE[current]),
			EDIT_PHASE_DURATIONS[phase],
		)
		return () => window.clearTimeout(timer)
	}, [enabled, phase, visible])

	return enabled ? phase : "before"
}

/**
 * Artwork that plays the edit: the edited image is revealed top to bottom behind a soft light
 * band (the "brush" of the AI), held, then faded out. The clip reset is delayed until the
 * fade ends so the image never visibly snaps back.
 */
function EditingArtwork({
	artwork,
	kind,
	phase,
}: {
	artwork?: BoardArtwork
	kind: ShowcaseKind
	phase: EditPhase
}) {
	const revealed = phase !== "before"
	return (
		<div className="relative size-full">
			<ArtworkImage artwork={artwork} kind={kind} />
			{artwork?.editedUrl ? (
				<>
					<motion.img
						src={artwork.editedUrl}
						alt=""
						draggable={false}
						className="absolute inset-0 size-full object-cover"
						initial={false}
						animate={{
							clipPath: revealed ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
							opacity: revealed ? 1 : 0,
						}}
						transition={
							revealed
								? {
										clipPath: { duration: 1.4, ease: [0.65, 0, 0.35, 1] },
										opacity: { duration: 0.01 },
									}
								: {
										opacity: { duration: 0.8, ease: "easeOut" },
										clipPath: { duration: 0, delay: 0.8 },
									}
						}
					/>
					<motion.div
						className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/70 to-transparent"
						initial={false}
						animate={
							phase === "editing"
								? { top: ["-15%", "100%"], opacity: [1, 1, 0] }
								: { top: "-15%", opacity: 0 }
						}
						transition={{
							duration: phase === "editing" ? 1.4 : 0,
							ease: [0.65, 0, 0.35, 1],
						}}
					/>
				</>
			) : null}
		</div>
	)
}

/** Tag above the edited card: "editing" while the wipe runs, then "done" during the hold. */
function EditStatusTag({ phase }: { phase: EditPhase }) {
	const { t } = useTranslation("aiCanvas")
	return (
		// Centered by a flex wrapper: the tag's own transform belongs to its motion, which would
		// override a Tailwind -translate-x-1/2 and leave it off-center.
		<span className="pointer-events-none absolute inset-x-0 -top-3 flex justify-center">
			<AnimatePresence mode="wait">
				{phase !== "before" ? (
					<motion.span
						key={phase}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.25 }}
						className={cn(
							"inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow-sm",
							phase === "editing" ? "bg-sky-500" : "bg-emerald-500",
						)}
					>
						{phase === "editing" ? (
							<Sparkles size={12} className="animate-pulse" />
						) : (
							<Check size={12} />
						)}
						{phase === "editing" ? t("home.board.editing") : t("home.board.edited")}
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	)
}

/**
 * Demo loop of the storyboard turning into a video:
 * | phase     | duration | what the board shows                                          |
 * | frames    | 2.6s     | the three frames side by side over an empty timeline          |
 * | composing | 1.6s     | frames stack onto the first slot, the card closes in on them, |
 * |           |          | and the timeline fills                                        |
 * | video     | 4.2s     | the card grows into one 16:9 video: last frame + play button  |
 */
export type StoryboardPhase = "frames" | "composing" | "video"

const STORYBOARD_PHASE_DURATIONS: Record<StoryboardPhase, number> = {
	frames: 2600,
	composing: 1600,
	video: 4200,
}
const NEXT_STORYBOARD_PHASE: Record<StoryboardPhase, StoryboardPhase> = {
	frames: "composing",
	composing: "video",
	video: "frames",
}

/** Runs the storyboard loop; stays on "frames" when disabled and pauses in hidden tabs. */
function useStoryboardPhase(enabled: boolean): StoryboardPhase {
	const [phase, setPhase] = useState<StoryboardPhase>("frames")
	const visible = usePageVisible()

	useEffect(() => {
		if (!enabled || !visible) return
		const timer = window.setTimeout(
			() => setPhase((current) => NEXT_STORYBOARD_PHASE[current]),
			STORYBOARD_PHASE_DURATIONS[phase],
		)
		return () => window.clearTimeout(timer)
	}, [enabled, phase, visible])

	return enabled ? phase : "frames"
}

/**
 * Card size per phase. Frames: three w-24/xl:w-28 16:9 frames with 4px gaps plus the 10px
 * timeline strip. Composing: the card closes in on the single stacked frame, so no empty
 * slots are left beside it. Video: one 16:9 player. Width and height transition in CSS, so
 * the board node's white frame, which wraps this card, resizes smoothly with it.
 */
const STORYBOARD_CARD_SIZE: Record<StoryboardPhase, string> = {
	frames: "h-[64px] w-[296px] xl:h-[73px] xl:w-[344px]",
	composing: "h-[64px] w-24 xl:h-[73px] xl:w-28",
	video: "h-[135px] w-[240px] xl:h-[153px] xl:w-[272px]",
}

/**
 * How far each frame slides to land on the first slot: whole frame widths plus the 4px gap.
 * Later frames render on top, so the stack ends on the last frame, which becomes the video.
 */
const STORYBOARD_COMPOSE_X = ["0%", "-104%", "-208%"]

/**
 * Storyboard that composes itself into a video: the frames slide together while the timeline
 * fills, then the card grows into a paused player showing the last frame. Without motion the
 * three frames simply stay side by side.
 */
function StoryboardStrip({
	frames,
	phase,
}: {
	frames: Array<BoardArtwork | undefined>
	phase: StoryboardPhase
}) {
	const { t } = useTranslation("aiCanvas")
	const isVideo = phase === "video"
	const stacked = phase !== "frames"
	const cover = frames[frames.length - 1]

	return (
		<div
			className={cn(
				"relative overflow-hidden transition-[width,height] duration-700 ease-in-out motion-reduce:transition-none",
				STORYBOARD_CARD_SIZE[phase],
			)}
		>
			{/* Fixed-width row anchored top-left: it keeps its layout while the card resizes. */}
			<div className="absolute left-0 top-0 flex gap-1">
				{frames.map((frame, index) => (
					<motion.div
						key={frame?.key ?? index}
						className="aspect-video w-24 overflow-hidden xl:w-28"
						initial={false}
						animate={{
							x: stacked ? STORYBOARD_COMPOSE_X[index] : "0%",
							scale: stacked ? 0.96 : 1,
							opacity: isVideo ? 0 : 1,
						}}
						transition={{
							x: { duration: 0.7, ease: [0.65, 0, 0.35, 1] },
							scale: { duration: 0.7, ease: [0.65, 0, 0.35, 1] },
							opacity: { duration: 0.3 },
						}}
					>
						<ArtworkImage artwork={frame} kind="storyboard" />
					</motion.div>
				))}
			</div>

			{/* Timeline under the frames: fills while composing, hidden once it is a video. */}
			<div
				className={cn(
					"absolute inset-x-0.5 bottom-0 h-1 overflow-hidden rounded-full bg-muted transition-opacity duration-300",
					isVideo ? "opacity-0" : "opacity-100",
				)}
			>
				<motion.div
					className="absolute inset-y-0 left-0 rounded-full bg-sky-500"
					initial={false}
					animate={{ width: phase === "composing" ? "100%" : "0%" }}
					transition={{
						duration:
							phase === "composing" ? STORYBOARD_PHASE_DURATIONS.composing / 1000 : 0,
						ease: "linear",
					}}
				/>
			</div>

			{/* Centered over the stacked frame by a flex box, since the tag's motion owns its transform. */}
			<div className="pointer-events-none absolute left-0 top-0 z-10 flex aspect-video w-24 items-center justify-center xl:w-28">
				<AnimatePresence>
					{phase === "composing" ? (
						<motion.span
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, delay: 0.4 }}
							className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
						>
							<Clapperboard size={10} className="animate-pulse" />
							{t("home.board.composing")}
						</motion.span>
					) : null}
				</AnimatePresence>
			</div>

			{/* The finished video: last frame as the paused picture, a play button and duration. */}
			<motion.div
				className="absolute inset-0 overflow-hidden"
				initial={false}
				animate={{ opacity: isVideo ? 1 : 0 }}
				transition={{ duration: 0.4, delay: isVideo ? 0.15 : 0 }}
			>
				<ArtworkImage artwork={cover} kind="storyboard" />
				<div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
				{/*
				  The play button settles in once, after the card has finished growing, and leaves at
				  once. A looping pulse ring flashed white over the dark picture on every restart, and a
				  button visible during the resize slid along with the moving center.
				*/}
				<div className="absolute inset-0 flex items-center justify-center">
					<motion.span
						className="flex size-9 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-md"
						initial={false}
						animate={isVideo ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
						transition={
							isVideo
								? { delay: 0.75, type: "spring", stiffness: 320, damping: 22 }
								: { duration: 0.15 }
						}
					>
						<Play size={14} className="ml-0.5 fill-current" />
					</motion.span>
				</div>
				<span className="absolute bottom-2.5 right-2 text-[10px] font-medium text-white">
					0:12
				</span>
				<span className="absolute inset-x-2 bottom-1.5 h-0.5 rounded-full bg-white/40" />
			</motion.div>
		</div>
	)
}

/** Diagonal highlight that sweeps across a product shot every few seconds, like a glint. */
function ProductGlint({ animated }: { animated: boolean }) {
	if (!animated) return null
	return (
		<motion.div
			className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
			initial={{ x: "0%" }}
			animate={{ x: "400%" }}
			transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.6 }}
		/>
	)
}

/**
 * Timing of the product generation demo, in ms: each card generates in turn, left to right,
 * then all three hold before the batch starts over.
 */
const PRODUCT_GENERATION_TIMING = { generate: 1600, hold: 6000 }

type GenerationState = "queued" | "generating" | "done"

/**
 * Counts how many product cards have finished generating; the card at that index is the one
 * generating now. Disabled (reduced motion) it reports every card done. Like the edit loop it
 * pauses while the tab is hidden, so a background tab schedules no timers.
 */
function useGenerationSequence(count: number, enabled: boolean) {
	const [doneCount, setDoneCount] = useState(0)
	const visible = usePageVisible()

	useEffect(() => {
		if (!enabled || !visible) return
		const timer = window.setTimeout(
			() => setDoneCount((current) => (current < count ? current + 1 : 0)),
			doneCount < count ? PRODUCT_GENERATION_TIMING.generate : PRODUCT_GENERATION_TIMING.hold,
		)
		return () => window.clearTimeout(timer)
	}, [count, doneCount, enabled, visible])

	return enabled ? doneCount : count
}

/**
 * One product card's content through its generation: a blank card while queued, a sweeping
 * shimmer with a "generating" tag while generating, then the image resolving from blur. When
 * the batch restarts the image fades back out quickly.
 */
function GeneratedArtwork({
	artwork,
	state,
	glint = false,
}: {
	artwork?: BoardArtwork
	state: GenerationState
	glint?: boolean
}) {
	const { t } = useTranslation("aiCanvas")
	const done = state === "done"

	return (
		<div className="relative size-full overflow-hidden bg-muted">
			{state === "generating" ? (
				<motion.div
					className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
					animate={{ x: ["0%", "200%"] }}
					transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
				/>
			) : null}
			{/* State-driven, so `initial={false}` only skips the mount fade; changes still animate. */}
			<motion.div
				className="absolute inset-0"
				initial={false}
				animate={
					done
						? { opacity: 1, scale: 1, filter: "blur(0px)" }
						: { opacity: 0, scale: 1.08, filter: "blur(16px)" }
				}
				transition={{ duration: done ? 0.9 : 0.4, ease: [0.22, 1, 0.36, 1] }}
			>
				<ArtworkImage artwork={artwork} kind="product" />
				{glint && done ? <ProductGlint animated /> : null}
			</motion.div>
			{/* Centered by a flex box, since the tag's motion owns its transform. */}
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<AnimatePresence>
					{state === "generating" ? (
						<motion.span
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
						>
							<Sparkles size={10} className="animate-pulse" />
							{t("home.board.generating")}
						</motion.span>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	)
}

/**
 * Spots of the two back cards, fanned out from the stack's bottom center like cards held in a
 * hand. Each sits about 60% of a card width out, so most of the back shot shows beside the
 * front card.
 */
const PRODUCT_FAN = [
	{ rotate: -16, x: -80, y: 12 },
	{ rotate: 16, x: 80, y: 12 },
] as const

/**
 * Product series as three cards fanned out. The cards generate one after another, the back
 * cards sway a couple of degrees out of step with each other and the front card floats; with
 * reduced motion all three images show and stay still.
 */
function ProductFan({
	label,
	products,
	animated,
}: {
	label: string
	products: Array<BoardArtwork | undefined>
	animated: boolean
}) {
	const [front, ...back] = products
	const card = "absolute inset-0 bg-background p-1 ring-1 ring-border"
	// Generation runs left to right across the fan: left back card, front card, right back card.
	const doneCount = useGenerationSequence(3, animated)
	const stateAt = (order: number): GenerationState => {
		if (order < doneCount) return "done"
		return order === doneCount ? "generating" : "queued"
	}

	return (
		<div className="flex flex-col gap-1.5">
			<span className="px-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
			<div className="relative aspect-square w-32 xl:w-36">
				{PRODUCT_FAN.map((spot, index) => (
					<motion.div
						key={spot.rotate}
						// Back cards cast a lighter shadow than the front card, so the shadows under
						// the overlap do not pile up into one dark patch.
						className={cn(
							card,
							"origin-bottom shadow-[0_10px_24px_-14px_rgb(15_23_42/0.35)]",
						)}
						initial={spot}
						animate={
							animated
								? {
										// Tilt a little further out and lift, then settle back.
										rotate: [
											spot.rotate,
											spot.rotate + Math.sign(spot.rotate) * 2,
											spot.rotate,
										],
										y: [spot.y, spot.y - 4, spot.y],
										x: spot.x,
									}
								: spot
						}
						transition={
							animated
								? {
										duration: 5,
										ease: "easeInOut",
										repeat: Infinity,
										delay: index * 1.6,
									}
								: { duration: 0 }
						}
					>
						<GeneratedArtwork
							artwork={back[index]}
							state={stateAt(index === 0 ? 0 : 2)}
						/>
					</motion.div>
				))}
				<motion.div
					className={cn(card, "shadow-[0_18px_40px_-18px_rgb(15_23_42/0.45)]")}
					animate={animated ? { y: [0, -3, 0] } : { y: 0 }}
					transition={
						animated
							? { duration: 6, ease: "easeInOut", repeat: Infinity }
							: { duration: 0 }
					}
				>
					<GeneratedArtwork artwork={front} state={stateAt(1)} glint={animated} />
				</motion.div>
			</div>
		</div>
	)
}

/**
 * Path of the design expert's cursor over the poster, relative to its resting spot beside the
 * poster's lower-left edge: it checks the sky, moves to the sun, then the cliff, and returns.
 */
const POSTER_CURSOR_PATH = {
	x: [0, 70, 150, 110, 0],
	y: [0, -150, -90, -20, 0],
	times: [0, 0.25, 0.5, 0.75, 1],
}

/**
 * The real canvas's toolbar for a selected image (CanvasDesign element-tools), in order:
 * image edits | media actions. Icons only, since the board copy is a scaled-down preview.
 */
const IMAGE_TOOL_GROUPS: Array<Array<{ key: string; Icon: ComponentType<LucideProps> }>> = [
	[
		{ key: "crop", Icon: Crop },
		{ key: "extend", Icon: Expand },
		{ key: "remove-background", Icon: Wand2 },
		{ key: "eraser", Icon: Eraser },
		{ key: "enhance", Icon: Hd },
		{ key: "prompt-extraction", Icon: Sparkles },
	],
	[
		{ key: "replace", Icon: RefreshCw },
		{ key: "download", Icon: Download },
	],
]

/**
 * Scaled-down copy of the toolbar the real canvas floats above a selected image. Purely
 * decorative: no buttons, no tab stops; the board layer is already hidden from assistive tech.
 */
function MiniImageToolbar() {
	return (
		<div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5 shadow-[0_6px_16px_-8px_rgb(15_23_42/0.3)]">
			{IMAGE_TOOL_GROUPS.map((group, groupIndex) => (
				<Fragment key={group[0].key}>
					{groupIndex > 0 ? <span className="h-3.5 w-px bg-border" /> : null}
					<span className="flex items-center">
						{group.map(({ key, Icon }) => (
							<span
								key={key}
								className="flex size-5 items-center justify-center rounded text-foreground/80"
							>
								<Icon size={11} />
							</span>
						))}
					</span>
				</Fragment>
			))}
		</div>
	)
}

const HANDLE_POSITIONS = [
	"-left-[4.5px] -top-[4.5px]",
	"-right-[4.5px] -top-[4.5px]",
	"-bottom-[4.5px] -left-[4.5px]",
	"-bottom-[4.5px] -right-[4.5px]",
] as const

/** A canvas element: a name tag above a framed image, like elements on the real canvas. */
function BoardNode({
	label,
	className,
	selected = false,
	toolbar,
	children,
}: {
	label: string
	className?: string
	selected?: boolean
	/** Element toolbar floating below the node, where the real canvas shows it for a selection. */
	toolbar?: ReactNode
	children: ReactNode
}) {
	return (
		<div className={cn("relative flex flex-col gap-1.5", className)}>
			{toolbar ? (
				<div className="absolute left-1/2 top-full mt-3 -translate-x-1/2">{toolbar}</div>
			) : null}
			<span className="px-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
			<div className="relative">
				<div className="overflow-hidden bg-background p-1 shadow-[0_18px_40px_-18px_rgb(15_23_42/0.45)] ring-1 ring-border">
					{children}
				</div>
				{selected ? (
					// Square selection box hugging the element, as on the real canvas; each 8px handle
					// is offset by half its size plus half the 1px border so its center sits on the
					// box corner.
					<div className="absolute -inset-px border border-sky-500">
						{HANDLE_POSITIONS.map((position) => (
							<span
								key={position}
								className={cn(
									"absolute size-2 border border-sky-500 bg-background",
									position,
								)}
							/>
						))}
					</div>
				) : null}
			</div>
		</div>
	)
}

/** Positions a board layer and moves it with the pointer; deeper layers move further. */
function ParallaxLayer({
	x,
	y,
	depth,
	className,
	children,
}: {
	x: MotionValue<number>
	y: MotionValue<number>
	depth: number
	className?: string
	children: ReactNode
}) {
	const translateX = useTransform(x, (value) => value * depth)
	const translateY = useTransform(y, (value) => value * depth)
	return (
		<motion.div className={cn("absolute", className)} style={{ x: translateX, y: translateY }}>
			{children}
		</motion.div>
	)
}

/**
 * Places each artwork on at most one board slot, in two passes: every slot first takes an
 * unused artwork of its own kind, then still-empty slots take leftovers in visual-weight order
 * (poster, character, front product, storyboard frames, then the two products fanned behind).
 * Slots left empty render placeholders.
 */
export function assignBoardSlots(artworks: BoardArtwork[]) {
	const slotKinds: ShowcaseKind[] = [
		"poster",
		"character",
		"product",
		"storyboard",
		"storyboard",
		"storyboard",
		"product",
		"product",
	]
	const used = new Set<string>()
	const assigned: Array<BoardArtwork | undefined> = slotKinds.map((kind) => {
		const match = artworks.find((item) => item.kind === kind && !used.has(item.key))
		if (match) used.add(match.key)
		return match
	})
	const leftovers = artworks.filter((item) => !used.has(item.key))
	const filled = assigned.map((artwork) => artwork ?? leftovers.shift())
	const [poster, character, frontProduct, ...rest] = filled
	const storyboard = rest.slice(0, 3)
	// Front card first; the fan renders the back cards underneath it.
	const products = [frontProduct, ...rest.slice(3)]
	return { poster, character, products, storyboard }
}

/** Character sheet → annotation note; highlighted while the note's edit plays. */
const NOTE_CONNECTOR_PATH = "M10 68 C 10 58, 12 54, 15 52"

const CONNECTOR_PATHS = [
	// Storyboard strip → selected poster, arching over the title.
	"M26 14 C 44 2, 64 2, 80 12",
	// Character sheet → annotation note.
	NOTE_CONNECTOR_PATH,
	// Product shot → poster.
	"M84 74 C 93 62, 95 46, 89 36",
]

/**
 * One loose pen stroke around a word: starts top-right, loops counter-clockwise and lifts off
 * just above where it started. The ends pass each other without meeting, so it reads as a
 * quick hand-drawn loop rather than a closed shape.
 */
const SCRIBBLE: Scribble = {
	start: [146, 20],
	segments: [
		[
			[108, 6],
			[40, 10],
			[16, 34],
		],
		[
			[-4, 56],
			[26, 92],
			[96, 94],
		],
		[
			[164, 96],
			[200, 72],
			[192, 42],
		],
		[
			[186, 14],
			[156, 0],
			[122, -2],
		],
	],
}
const SCRIBBLE_CENTERLINE = scribbleToPathData(SCRIBBLE)
// Broad highlighter nib: full width where it lands, narrowing a little as it lifts.
const SCRIBBLE_OUTLINE = buildTaperedOutline(SCRIBBLE, { startWidth: 11, endWidth: 6 })

/** One pen stroke shortly after the page settles; it plays once and the circle stays. */
const SCRIBBLE_TRANSITION: Transition = { duration: 1.2, ease: "easeInOut", delay: 0.4 }

/**
 * Wraps the highlighted word of the hero title in a circle drawn with a fluorescent marker.
 * The tapered outline is a filled shape, which `pathLength` cannot draw, so a wide stroke along
 * the centerline masks it in and reveals the shape the way a pen moves. It draws once on mount;
 * with reduced motion the circle is simply there. A tab opened in the background plays it on
 * first view, because animation frames pause while the tab is hidden.
 *
 * The ink is translucent and multiplies with what lies beneath, so letters it crosses stay
 * crisp like real highlighter ink; dark mode screens it instead, because multiply would vanish
 * on a dark board. The horizontal margin keeps the circle off the neighboring characters.
 */
export function ScribbleCircle({ children }: { children?: ReactNode }) {
	const animated = !useReducedMotion()
	// Mask ids must be unique because the hero can mount more than once (e.g. route transitions).
	const maskId = `scribble-${useId().replace(/:/g, "")}`

	return (
		<span className="relative mx-[0.35em] inline-block whitespace-nowrap">
			{children}
			<svg
				aria-hidden="true"
				viewBox="0 0 200 100"
				preserveAspectRatio="none"
				className="pointer-events-none absolute -left-[15%] -top-[20%] h-[140%] w-[130%] overflow-visible text-[#ffe23a] opacity-55 mix-blend-multiply dark:opacity-45 dark:mix-blend-screen"
			>
				<defs>
					<mask
						id={maskId}
						maskUnits="userSpaceOnUse"
						x="-20"
						y="-20"
						width="240"
						height="140"
					>
						{/* Just wider than the 11-unit nib, so it never uncovers the nearby tail early. */}
						<motion.path
							d={SCRIBBLE_CENTERLINE}
							fill="none"
							stroke="white"
							strokeWidth={14}
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={{ pathLength: animated ? 0 : 1 }}
							animate={{ pathLength: 1 }}
							transition={animated ? SCRIBBLE_TRANSITION : { duration: 0 }}
						/>
					</mask>
				</defs>
				<path d={SCRIBBLE_OUTLINE} fill="currentColor" mask={`url(#${maskId})`} />
			</svg>
		</span>
	)
}

/**
 * First screen of the AI canvas home, drawn as a live canvas: storyboard frames, a selected
 * poster, a character sheet and a product shot sit on a dotted board, linked by connectors,
 * with an annotation and the AI's cursor. The composer floats in the middle like a toolbar.
 *
 * Decorative layers are hidden from assistive tech and never take pointer events. Board
 * elements only appear on wide screens so the composer always keeps its space; pointer
 * parallax is disabled when the user prefers reduced motion.
 */
function AiCanvasHero({ artworks, children, footer }: AiCanvasHeroProps) {
	const { t } = useTranslation("aiCanvas")
	const reduceMotion = useReducedMotion()
	const pointerX = useMotionValue(0)
	const pointerY = useMotionValue(0)
	const x = useSpring(pointerX, { stiffness: 60, damping: 20 })
	const y = useSpring(pointerY, { stiffness: 60, damping: 20 })

	const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
		if (reduceMotion) return
		const rect = event.currentTarget.getBoundingClientRect()
		// Offset from the center, mapped to at most ~12px x / 8px y for a depth-1 layer.
		pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * -24)
		pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * -16)
	}

	const slots = assignBoardSlots(artworks)
	// Every board animation is off when the user prefers reduced motion.
	const animated = !reduceMotion
	// The character card demonstrates the note's edit when an edited version exists.
	const editPhase = useEditPhase(animated && Boolean(slots.character?.editedUrl))
	const storyboardPhase = useStoryboardPhase(animated)

	return (
		<section
			className="relative isolate flex min-h-[78vh] w-full items-center overflow-hidden border-b border-border/60 px-4 pb-6 pt-16 md:px-10 md:pt-20"
			data-testid="ai-canvas-hero"
			onPointerMove={handlePointerMove}
			onPointerLeave={() => {
				pointerX.set(0)
				pointerY.set(0)
			}}
		>
			{/* Dotted board, fading out toward the bottom edge of the hero. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					backgroundImage:
						"radial-gradient(oklch(var(--foreground) / 0.16) 1px, transparent 1.2px)",
					backgroundSize: "24px 24px",
					WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
					maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
				}}
			/>
			{/* Soft color fields; radial gradients fade out on their own so edges never clip. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					backgroundImage: [
						"radial-gradient(34rem 22rem at 18% 18%, rgb(196 181 253 / 0.25), transparent 70%)",
						"radial-gradient(34rem 22rem at 84% 70%, rgb(253 224 171 / 0.28), transparent 70%)",
					].join(", "),
				}}
			/>

			{/* Board elements sit behind the composer (z-0) and ignore the pointer entirely. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 hidden lg:block"
			>
				<svg
					className="absolute inset-0 size-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					{CONNECTOR_PATHS.map((path) => (
						<path
							key={path}
							d={path}
							fill="none"
							className="stroke-muted-foreground/40"
							strokeWidth="1.2"
							strokeDasharray="4 5"
							vectorEffect="non-scaling-stroke"
						/>
					))}
					{/* While editing, the note's instruction "flows" along its connector to the card. */}
					<motion.path
						d={NOTE_CONNECTOR_PATH}
						fill="none"
						className="stroke-sky-500"
						strokeWidth="1.6"
						strokeDasharray="4 5"
						vectorEffect="non-scaling-stroke"
						initial={false}
						animate={
							editPhase === "editing"
								? { opacity: 1, strokeDashoffset: [0, 18] }
								: { opacity: 0, strokeDashoffset: 0 }
						}
						transition={
							editPhase === "editing"
								? {
										opacity: { duration: 0.2 },
										strokeDashoffset: {
											duration: 0.6,
											ease: "linear",
											repeat: Infinity,
										},
									}
								: { duration: 0.3 }
						}
					/>
				</svg>

				<ParallaxLayer x={x} y={y} depth={0.6} className="left-[3%] top-[6%]">
					<BoardNode
						label={
							storyboardPhase === "video"
								? t("home.board.storyboardVideo")
								: t("home.board.storyboard")
						}
						className="-rotate-2"
					>
						<StoryboardStrip frames={slots.storyboard} phase={storyboardPhase} />
					</BoardNode>
				</ParallaxLayer>

				<ParallaxLayer x={x} y={y} depth={1} className="right-[4%] top-[5%]">
					<BoardNode
						label={t("home.board.poster")}
						className="rotate-2"
						selected
						toolbar={<MiniImageToolbar />}
					>
						<div className="aspect-[3/4] w-36 overflow-hidden xl:w-44">
							{/* Slow push-in on the poster, like a camera move on a key visual. */}
							<motion.div
								className="size-full"
								animate={animated ? { scale: [1, 1.08, 1] } : { scale: 1 }}
								transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
							>
								<ArtworkImage artwork={slots.poster} kind="poster" />
							</motion.div>
						</div>
					</BoardNode>
					{/* The AI collaborator's cursor, roaming the poster it is working on. */}
					<motion.div
						// Rests beside the poster's lower-left edge rather than under it, so it never covers
						// the element toolbar below the poster.
						className="absolute -left-14 bottom-[16%] flex items-start gap-1"
						animate={
							animated
								? { x: POSTER_CURSOR_PATH.x, y: POSTER_CURSOR_PATH.y }
								: { x: 0, y: 0 }
						}
						transition={{
							duration: 9,
							ease: "easeInOut",
							times: POSTER_CURSOR_PATH.times,
							repeat: Infinity,
						}}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" className="fill-sky-500">
							<path d="M1 1 L15 6 L8.5 8.5 L6 15 Z" />
						</svg>
						<span className="mt-3 inline-flex items-center gap-1 rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
							<Sparkles size={12} />
							{t("home.board.cursor")}
						</span>
					</motion.div>
				</ParallaxLayer>

				<ParallaxLayer x={x} y={y} depth={0.8} className="bottom-[10%] left-[4%]">
					<BoardNode
						label={t("home.board.character")}
						className="relative rotate-1"
						selected={editPhase === "editing"}
					>
						<div className="aspect-[3/4] w-32 overflow-hidden xl:w-36">
							<EditingArtwork
								artwork={slots.character}
								kind="character"
								phase={editPhase}
							/>
						</div>
					</BoardNode>
					<EditStatusTag phase={editPhase} />
				</ParallaxLayer>

				<ParallaxLayer
					x={x}
					y={y}
					depth={0.5}
					className="left-[13%] top-[42%] hidden 2xl:block"
				>
					<div className="w-40 -rotate-3 rounded-lg bg-amber-100 p-3 text-xs leading-5 text-amber-950 shadow-lg dark:bg-amber-200">
						{t("home.board.note")}
					</div>
				</ParallaxLayer>

				{/* Inset further than the other nodes: the fanned-out right card reaches ~90px past it. */}
				<ParallaxLayer x={x} y={y} depth={0.9} className="bottom-[8%] right-[9%]">
					<div className="-rotate-2">
						<ProductFan
							label={t("home.board.product")}
							products={slots.products}
							animated={animated}
						/>
					</div>
				</ParallaxLayer>
			</div>

			<div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
				<div className="flex flex-col items-center gap-3 text-center">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
						<Sparkles size={16} aria-hidden="true" />
						{t("home.title")}
					</span>
					<h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
						<Trans
							t={t}
							i18nKey="home.heroTitle"
							components={{ circle: <ScribbleCircle /> }}
						/>
					</h1>
					<p className="max-w-xl text-sm text-muted-foreground md:text-base">
						{t("home.subtitle")}
					</p>
					{footer}
				</div>
				{/* The composer floats over the board in the canvas-specific frame. */}
				<AiCanvasComposerFrame>{children}</AiCanvasComposerFrame>
			</div>
		</section>
	)
}

export default memo(AiCanvasHero)
