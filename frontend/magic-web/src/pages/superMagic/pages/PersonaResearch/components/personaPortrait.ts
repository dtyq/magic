/**
 * Built-in SVG fallbacks for AI personas. Everything is picked deterministically from
 * the persona's name, so one person always looks the same; gender and age only choose the
 * hairstyle family and grey hair. No facial features: a drawn face reads as clip art.
 */

export type PortraitGender = "male" | "female" | "unknown"

/** Soft backdrops and deeper clothing tones that sit well side by side. */
const BACKDROPS = [
	"#dfe8e1",
	"#e3e7f1",
	"#efe4d8",
	"#e9e1ee",
	"#e0ebee",
	"#efe6e1",
	"#e6ead9",
	"#e4e2e9",
]
const CLOTHES = [
	"#2f5d47",
	"#2f4a7a",
	"#7a4a2f",
	"#5b3f78",
	"#2e6e74",
	"#8a3b45",
	"#55642e",
	"#3c3f4a",
]
const SKINS = ["#f1d3bd", "#e8c2a4", "#dcae8c", "#c99877"]
const HAIRS = ["#231d1b", "#33251f", "#45322a"]
const GREY_HAIR = "#a19b95"

const MALE_HAIR = ["crop", "sidePart", "buzz"] as const
const FEMALE_HAIR = ["bob", "long", "bun", "ponytail"] as const
type HairStyle = (typeof MALE_HAIR)[number] | (typeof FEMALE_HAIR)[number]

export interface PortraitSpec {
	backdrop: string
	clothes: string
	skin: string
	hair: string
	hairStyle: HairStyle
	glasses: boolean
}

function hashOf(text: string): number {
	let hash = 2166136261
	for (const char of text) {
		hash ^= char.codePointAt(0) ?? 0
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

/** Picks from a list with a different slice of the hash for each trait. */
function pick<T>(list: readonly T[], hash: number, shift: number): T {
	return list[(hash >>> shift) % list.length]
}

export function resolvePortrait(seed: string, gender: PortraitGender, age?: number): PortraitSpec {
	const hash = hashOf(seed)
	const styles: readonly HairStyle[] =
		gender === "male"
			? MALE_HAIR
			: gender === "female"
				? FEMALE_HAIR
				: [...MALE_HAIR, ...FEMALE_HAIR]
	return {
		backdrop: pick(BACKDROPS, hash, 0),
		clothes: pick(CLOTHES, hash, 3),
		skin: pick(SKINS, hash, 6),
		hair: age !== undefined && age >= 55 ? GREY_HAIR : pick(HAIRS, hash, 9),
		hairStyle: pick(styles, hash, 12),
		glasses: (hash >>> 15) % 5 === 0,
	}
}

export interface PersonaTone {
	/** Deep clothing colour: quote blocks carry white text on it. */
	tone: string
	/** Translucent wash for headers and selected rows; readable in light and dark themes. */
	tint: string
	/** Stronger wash for highlighter marks in transcripts. */
	mark: string
}

/**
 * Stable persona colour for quotes, cards and highlights, independent of generated photos.
 * Uses the same seed as the fallback (name, then id). Alpha hex instead of
 * color-mix keeps the Chrome 100 baseline.
 */
export function personaTone(seed: string): PersonaTone {
	const tone = pick(CLOTHES, hashOf(seed), 3)
	return { tone, tint: `${tone}1f`, mark: `${tone}33` }
}

/** Reads "male" / "男" / "female" / "女" from a persona's demographics. */
export function genderOf(demographics: Record<string, unknown> | undefined): PortraitGender {
	const value = String(demographics?.gender ?? "").toLowerCase()
	if (value === "male" || value === "m" || value.startsWith("男")) return "male"
	if (value === "female" || value === "f" || value.startsWith("女")) return "female"
	return "unknown"
}

export function ageOf(demographics: Record<string, unknown> | undefined): number | undefined {
	const age = Number.parseInt(String(demographics?.age ?? ""), 10)
	return Number.isFinite(age) ? age : undefined
}

/** Hair drawn behind the head, over the shoulders (long hair, bob sides, ponytail). */
export const BACK_HAIR: Partial<Record<HairStyle, string>> = {
	long: "M19 49C17.5 26 22.5 13.5 32 13.5S46.5 26 45 49C42 50.5 39.5 50 38 48.5L37.5 36H26.5L26 48.5C24.5 50 22 50.5 19 49Z",
	bob: "M20 38C18.5 23 23.5 13.5 32 13.5S45.5 23 44 38C42.5 39 41 39 40 38V30H24V38C23 39 21.5 39 20 38Z",
	ponytail: "M40 22C46 22 49 30 46.5 40C45 36 43 31 40 28Z",
}

/** Hair drawn over the head. */
export const FRONT_HAIR: Record<HairStyle, string> = {
	crop: "M22.4 26.5C21.8 16.5 26.5 13.2 32 13.2S42.2 16.5 41.6 26.5C40 21.6 37 19.6 32 19.6S24 21.6 22.4 26.5Z",
	sidePart:
		"M22.4 27.5C21.3 15.5 27.5 12.8 33 13.2C39.2 13.6 42.8 18 41.6 27.5C40.6 22 39 20 35.2 19L30.2 21.2C26.2 21.6 23.6 23.8 22.4 27.5Z",
	buzz: "M23 24.5C23.4 16.2 27.8 14.4 32 14.4S40.6 16.2 41 24.5C39.2 20.4 36.2 18.8 32 18.8S24.8 20.4 23 24.5Z",
	bob: "M22.4 27.5C22 17.2 26.8 14 32 14S42 17.2 41.6 27.5C39.6 22.6 36.2 20.8 32 20.8S24.4 22.6 22.4 27.5Z",
	long: "M22.4 27.5C22 17.2 26.8 14 32 14S42 17.2 41.6 27.5C38.6 22 35.6 20.4 31 21.2C27.4 21.8 24.4 23.6 22.4 27.5Z",
	bun: "M22.4 26.5C22 17.2 26.8 14.4 32 14.4S42 17.2 41.6 26.5C40 21.8 36.8 20 32 20S24 21.8 22.4 26.5ZM32 7.6A4.8 4.8 0 1 1 31.99 7.6Z",
	ponytail:
		"M22.4 26.5C22 17.2 26.8 14.2 32 14.2S42 17.2 41.6 26.5C40 21.8 36.8 20 32 20S24 21.8 22.4 26.5Z",
}
