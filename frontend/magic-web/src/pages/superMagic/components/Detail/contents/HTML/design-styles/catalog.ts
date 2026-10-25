import { getStyleProfile } from "./styleProfiles"

export interface DesignColorToken {
	name: string
	value: string | number | boolean
}

export interface DesignTypographyToken {
	name: string
	fontFamily?: string | number | boolean
	fontSize?: string | number | boolean
	fontWeight?: string | number | boolean
	lineHeight?: string | number | boolean
	letterSpacing?: string | number | boolean
}

export interface DesignScaleToken {
	name: string
	value: string | number | boolean
}

export interface DesignStyleData {
	colors: DesignColorToken[]
	typography: DesignTypographyToken[]
	spacing: DesignScaleToken[]
	rounded: DesignScaleToken[]
	components: string[]
	sections: Record<string, string>
}

export type DesignStylePreviewLayout = "poster" | "dashboard" | "editorial" | "commerce"

export interface DesignStyle {
	code: string
	title: string
	description: string
	category: string
	tags: string[]
	featured: boolean
	preview?: {
		layout?: DesignStylePreviewLayout
	}
	design: DesignStyleData
}

export interface DesignStyleCatalog {
	format: string
	formatVersion: number
	styles: DesignStyle[]
}

const CATALOG_PATH = "html-design-style/catalog.json"
const CATALOG_TIMEOUT_MS = 10_000

let catalogPromise: Promise<DesignStyleCatalog> | null = null

function getCatalogUrl(): string {
	const baseUrl = String(import.meta.env.BASE_URL || "/")
	return `${baseUrl.replace(/\/+$/, "")}/${CATALOG_PATH}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function isDesignStyle(value: unknown): value is DesignStyle {
	if (!isRecord(value)) return false
	if (
		typeof value.code !== "string" ||
		typeof value.title !== "string" ||
		typeof value.description !== "string" ||
		typeof value.category !== "string" ||
		typeof value.featured !== "boolean" ||
		!Array.isArray(value.tags) ||
		!value.tags.every((tag) => typeof tag === "string")
	) {
		return false
	}

	const preview = value.preview
	if (
		preview !== undefined &&
		(!isRecord(preview) ||
			(preview.layout !== undefined &&
				!["poster", "dashboard", "editorial", "commerce"].includes(String(preview.layout))))
	) {
		return false
	}

	const design = value.design
	return (
		isRecord(design) &&
		Array.isArray(design.colors) &&
		Array.isArray(design.typography) &&
		Array.isArray(design.spacing) &&
		Array.isArray(design.rounded) &&
		Array.isArray(design.components) &&
		isRecord(design.sections) &&
		Object.values(design.sections).every((section) => typeof section === "string")
	)
}

function parseCatalog(value: unknown): DesignStyleCatalog {
	if (
		!isRecord(value) ||
		value.format !== "design-md" ||
		typeof value.formatVersion !== "number" ||
		!Array.isArray(value.styles) ||
		!value.styles.every(isDesignStyle)
	) {
		throw new Error("Invalid HTML design style catalog")
	}

	return value as unknown as DesignStyleCatalog
}

export function getDesignStyleCatalogUrl(): string {
	return getCatalogUrl()
}

export function loadDesignStyleCatalog(): Promise<DesignStyleCatalog> {
	if (catalogPromise) return catalogPromise

	catalogPromise = (async () => {
		const controller = new AbortController()
		const timeout = window.setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS)
		try {
			const response = await fetch(getCatalogUrl(), {
				signal: controller.signal,
				headers: { Accept: "application/json" },
			})
			if (!response.ok) {
				throw new Error(`Failed to load HTML design style catalog: ${response.status}`)
			}
			return parseCatalog(await response.json())
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new Error("Timed out loading HTML design style catalog")
			}
			throw error
		} finally {
			window.clearTimeout(timeout)
		}
	})()

	catalogPromise.catch(() => {
		catalogPromise = null
	})
	return catalogPromise
}

export function resetDesignStyleCatalogCache() {
	catalogPromise = null
}

export function getDesignStyleCategories(styles: DesignStyle[]) {
	return [
		{ code: "all" },
		{ code: "featured" },
		...Array.from(
			new Map(styles.map((style) => [style.category, style.category])).entries(),
		).map(([code]) => ({ code })),
	]
}

export function filterDesignStyles(styles: DesignStyle[], query: string, category: string) {
	const normalizedQuery = query.trim().toLocaleLowerCase()
	return styles.filter((style) => {
		const matchesCategory =
			category === "all" ||
			(category === "featured" ? style.featured : style.category === category)
		if (!matchesCategory) return false
		if (!normalizedQuery) return true
		const profile = getStyleProfile(style.code)
		return [
			style.title,
			style.code,
			style.description,
			profile?.name.zh,
			profile?.name.en,
			profile?.description.zh,
			profile?.description.en,
			...style.tags,
		]
			.filter(Boolean)
			.join(" ")
			.toLocaleLowerCase()
			.includes(normalizedQuery)
	})
}
