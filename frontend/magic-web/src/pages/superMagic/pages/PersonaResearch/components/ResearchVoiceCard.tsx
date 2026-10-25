import { useEffect, useMemo, useState } from "react"
import { AudioLines, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { PersonaFile } from "../types"
import HangingQuote from "./HangingQuote"
import PersonaAvatar from "./PersonaAvatar"
import { EASE_OUT } from "./surface"
import { personaTone } from "./personaPortrait"

const ROTATE_MS = 5200
const MAX_VOICES = 4

/** One line on the card, from a library persona or a built-in sample. */
interface Voice {
	id: string
	name: string
	demographics?: Record<string, unknown>
	/** "Name · 45 岁 · City" */
	byline: string
	tags: string[]
	text: string
}

/** Built-in sample shown while the library is empty; copy lives in the locale files. */
interface SampleVoice {
	name: string
	age: string
	gender: string
	city: string
	tags: string[]
	line: string
}

/** First quotable line of a persona: how they talk (expression layer), else an evidence quote. */
export function personaVoiceLine(persona: PersonaFile): string | null {
	for (const item of persona.layers?.expression ?? []) {
		if (typeof item === "string" && item.trim()) return item.trim()
		if (item && typeof item === "object" && "text" in item) {
			const text = String((item as { text: unknown }).text ?? "").trim()
			if (text) return text
		}
	}
	return persona.evidence?.find((item) => item.quote?.trim())?.quote?.trim() ?? null
}

/** Short display text for a free-form persona field; objects and long text are skipped. */
function textOf(value: unknown): string | null {
	if (typeof value !== "string" && typeof value !== "number") return null
	const text = String(value).trim()
	return text && text.length <= 12 ? text : null
}

interface ResearchVoiceCardProps {
	personas: PersonaFile[]
	onOpenLibrary: () => void
	className?: string
}

/**
 * Home hero visual: lines from the user's persona library, one at a time on the speaker's colour.
 * It replaces drawn illustration. With no quotable persona it rotates built-in samples, labelled
 * as samples, until the first study fills the library.
 */
export default function ResearchVoiceCard({
	personas,
	onOpenLibrary,
	className,
}: ResearchVoiceCardProps) {
	const { t } = useTranslation("personaResearch")
	const libraryVoices = useMemo<Voice[]>(
		() =>
			personas
				.map((persona) => {
					const text = personaVoiceLine(persona)
					if (!text) return null
					// Ages arrive as "45" or "45岁"; the label adds its own unit.
					const age = textOf(persona.dimensions?.demographics?.age)?.replace(
						/\s*(岁|yrs?|years?)$/i,
						"",
					)
					const geography = persona.dimensions?.geography
					const place = textOf(
						geography?.city ?? geography?.region ?? geography?.location,
					)
					return {
						id: persona.id,
						name: persona.name,
						demographics: persona.dimensions?.demographics,
						byline: [persona.name, age ? t("voice.age", { age }) : null, place]
							.filter(Boolean)
							.join(" · "),
						tags: [...(persona.tags ?? []).slice(0, 2), t("persona.aiSimulated")],
						text,
					}
				})
				.filter((voice): voice is Voice => voice !== null)
				.slice(0, MAX_VOICES),
		[personas, t],
	)
	const sampleVoices = useMemo<Voice[]>(() => {
		const samples = t("voice.samples", { returnObjects: true })
		if (!Array.isArray(samples)) return []
		return (samples as SampleVoice[]).map((sample, i) => ({
			id: `sample-${i}`,
			name: sample.name,
			demographics: { age: sample.age, gender: sample.gender },
			byline: [sample.name, t("voice.age", { age: sample.age }), sample.city].join(" · "),
			tags: [...sample.tags, t("voice.sampleBadge")],
			text: sample.line,
		}))
	}, [t])
	const isSample = libraryVoices.length === 0
	const voices = isSample ? sampleVoices : libraryVoices
	const [index, setIndex] = useState(0)
	const [visible, setVisible] = useState(true)

	useEffect(() => {
		if (voices.length < 2) return
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
		let fadeTimer: number | undefined
		// Fade the text out, swap the voice, fade back in; the card colour eases with it.
		const timer = window.setInterval(() => {
			setVisible(false)
			fadeTimer = window.setTimeout(() => {
				setIndex((value) => (value + 1) % voices.length)
				setVisible(true)
			}, 320)
		}, ROTATE_MS)
		return () => {
			window.clearInterval(timer)
			window.clearTimeout(fadeTimer)
		}
	}, [voices.length])

	if (voices.length === 0) return null
	const voice = voices[index % voices.length]
	const { tone, tint } = personaTone(voice.name || voice.id)

	return (
		<aside
			className={cn(
				// A light card like the rest of the page; the speaker's colour only tints it, marks
				// the quote and the dots, so the hero reads as one piece instead of a colour block.
				"relative flex min-h-[340px] flex-col overflow-hidden rounded-2xl px-6 pb-5 pt-6 ring-1 ring-border transition-colors duration-500",
				className,
			)}
			style={{ backgroundColor: tint }}
			aria-live="polite"
			data-testid="persona-research-voice-card"
		>
			<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<AudioLines className="size-4" style={{ color: tone }} />
				{t(isSample ? "voice.sampleLabel" : "voice.label")}
			</span>
			<div
				className={cn(
					// The quote leaves and returns through a slight blur and lift, not a hard cut.
					"flex flex-1 flex-col justify-center gap-5 py-4 transition-[opacity,filter,transform] duration-300",
					EASE_OUT,
					visible
						? "translate-y-0 opacity-100 blur-0"
						: "translate-y-1 opacity-0 blur-[2px]",
				)}
			>
				<span style={{ color: tone }}>
					<HangingQuote
						text={voice.text}
						clampClassName="line-clamp-5 text-foreground"
						className="text-[22px] font-bold leading-[1.5] tracking-tight"
					/>
				</span>
				<span className="flex items-center gap-3 text-[13px]">
					<PersonaAvatar
						id={voice.id}
						name={voice.name}
						demographics={voice.demographics}
						shape="square"
						className="size-11"
					/>
					{/* Name, age and place first; tags (not the long tagline) as the quiet second line. */}
					<span className="flex min-w-0 flex-col">
						<span className="truncate font-medium text-foreground">{voice.byline}</span>
						<span className="line-clamp-1 text-xs text-muted-foreground">
							{voice.tags.join(" · ")}
						</span>
					</span>
				</span>
			</div>
			<div className="flex items-center justify-between border-t border-foreground/10 pt-3.5 text-[12.5px]">
				{/* An empty library has nothing to open; say where real voices will come from instead. */}
				{isSample ? (
					<span className="text-muted-foreground">{t("voice.sampleHint")}</span>
				) : (
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						onClick={onOpenLibrary}
					>
						{t("voice.fromLibrary")}
						<ChevronRight className="size-3.5" />
					</button>
				)}
				{voices.length > 1 ? (
					<span className="flex items-center gap-1.5" aria-hidden>
						{voices.map((item, dot) => (
							<span
								key={item.id}
								className={cn(
									"h-1.5 rounded-full transition-all duration-300",
									dot === index % voices.length
										? "w-[18px]"
										: "w-1.5 bg-foreground/15",
								)}
								style={
									dot === index % voices.length
										? { backgroundColor: tone }
										: undefined
								}
							/>
						))}
					</span>
				) : null}
			</div>
		</aside>
	)
}
