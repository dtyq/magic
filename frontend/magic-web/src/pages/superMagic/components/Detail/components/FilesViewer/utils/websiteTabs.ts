import type { FileItem, TabItem, WebsitePreset } from "../types"
import { isInternationalEnv } from "@/utils/env"
import baiduImagesIcon from "../assets/website-presets/baidu-images.png"
import bingImagesIcon from "../assets/website-presets/bing-images.svg"
import pexelsIcon from "../assets/website-presets/pexels.png"

export const WEBSITE_TAB_PREFIX = "website:"
export const COMMON_WEBSITE_PRESETS_STORAGE_KEY = "magic:files-viewer:common-website-presets"
export const COMMON_WEBSITE_PRESETS_CHANGE_EVENT = "magic:common-website-presets-change"
export const COMMON_WEBSITE_PRESETS_LIMIT = 20

export type SaveCommonWebsitePresetResult =
	| { status: "saved"; preset: WebsitePreset }
	| { status: "exists"; preset: WebsitePreset }
	| { status: "limit" }
	| { status: "invalid" }

export const WEBSITE_PRESETS: WebsitePreset[] = [
	{
		id: "baidu-images",
		titleKey: "fileViewer.website.presets.baiduImages.title",
		descriptionKey: "fileViewer.website.presets.baiduImages.description",
		iconSrc: baiduImagesIcon,
		url: "https://image.baidu.com/search/index?tn=baiduimage&fm=result&ie=utf-8&word=%E4%B8%96%E7%95%8C%E7%BE%8E%E6%99%AF",
	},
	{
		id: "bing-images",
		titleKey: "fileViewer.website.presets.bingImages.title",
		descriptionKey: "fileViewer.website.presets.bingImages.description",
		iconSrc: bingImagesIcon,
		url: "https://www.bing.com/images/search",
	},
	{
		id: "pexels",
		titleKey: "fileViewer.website.presets.pexels.title",
		descriptionKey: "fileViewer.website.presets.pexels.description",
		iconSrc: pexelsIcon,
		url: "https://www.pexels.com/",
	},
]

export function getWebsitePresets(isInternational = isInternationalEnv()) {
	if (!isInternational) return WEBSITE_PRESETS

	return WEBSITE_PRESETS.filter((preset) => preset.id !== "baidu-images")
}

function normalizeWebsiteUrl(rawUrl: string) {
	const trimmedUrl = rawUrl.trim()
	if (!trimmedUrl) return null

	const urlWithProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmedUrl)
		? trimmedUrl
		: `https://${trimmedUrl}`

	try {
		const url = new URL(urlWithProtocol)
		if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
			return null
		}
		if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
			url.protocol = "https:"
		}
		return url
	} catch {
		return null
	}
}

function createWebsiteSlug(url: URL) {
	const slugSource = `${url.hostname}${url.pathname}${url.search}`
	return (
		slugSource
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "website"
	)
}

function isLoopbackHost(hostname: string) {
	const normalizedHostname = hostname.toLowerCase()
	return (
		normalizedHostname === "localhost" ||
		normalizedHostname.endsWith(".localhost") ||
		normalizedHostname === "127.0.0.1" ||
		normalizedHostname === "[::1]" ||
		normalizedHostname === "::1"
	)
}

export function buildCustomWebsitePreset(rawUrl: string, description = "Custom website") {
	const url = normalizeWebsiteUrl(rawUrl)
	if (!url) return null

	return {
		id: `custom-${createWebsiteSlug(url)}`,
		title: url.hostname.replace(/^www\./, ""),
		url: url.href,
		description,
	}
}

function getCommonWebsiteStorage(storage?: Storage) {
	if (storage) return storage
	if (typeof window === "undefined") return null
	return window.localStorage
}

function emitCommonWebsitePresetsChange() {
	if (typeof window === "undefined") return
	window.dispatchEvent(new CustomEvent(COMMON_WEBSITE_PRESETS_CHANGE_EVENT))
}

export function getCommonWebsitePresets(storage?: Storage): WebsitePreset[] {
	const targetStorage = getCommonWebsiteStorage(storage)
	if (!targetStorage) return []

	try {
		const parsed = JSON.parse(targetStorage.getItem(COMMON_WEBSITE_PRESETS_STORAGE_KEY) || "[]")
		if (!Array.isArray(parsed)) return []

		return parsed
			.map((item) => {
				if (!item || typeof item !== "object") return null
				const url = normalizeWebsiteUrl(String(item.url || ""))
				if (!url) return null
				const title =
					typeof item.title === "string" && item.title.trim()
						? item.title.trim()
						: url.hostname.replace(/^www\./, "")
				return {
					id: `common-${createWebsiteSlug(url)}`,
					title,
					url: url.href,
					description:
						typeof item.description === "string" ? item.description.trim() : undefined,
				}
			})
			.filter((item): item is WebsitePreset => Boolean(item))
			.slice(0, COMMON_WEBSITE_PRESETS_LIMIT)
	} catch {
		return []
	}
}

export function saveCommonWebsitePreset(
	preset: Pick<WebsitePreset, "url"> & Partial<Pick<WebsitePreset, "title" | "description">>,
	storage?: Storage,
) {
	const targetStorage = getCommonWebsiteStorage(storage)
	const url = normalizeWebsiteUrl(preset.url)
	if (!targetStorage || !url) return { status: "invalid" } satisfies SaveCommonWebsitePresetResult

	const savedPreset: WebsitePreset = {
		id: `common-${createWebsiteSlug(url)}`,
		title: preset.title?.trim() || url.hostname.replace(/^www\./, ""),
		url: url.href,
		description: preset.description?.trim() || undefined,
	}
	const existingPresets = getCommonWebsitePresets(targetStorage)
	const existingPreset = existingPresets.find(
		(item) => normalizeWebsiteUrl(item.url)?.href === url.href,
	)
	if (existingPreset) {
		return { status: "exists", preset: existingPreset }
	}
	if (existingPresets.length >= COMMON_WEBSITE_PRESETS_LIMIT) {
		return { status: "limit" }
	}

	const nextPresets = [savedPreset, ...existingPresets].slice(0, COMMON_WEBSITE_PRESETS_LIMIT)

	targetStorage.setItem(COMMON_WEBSITE_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets))
	emitCommonWebsitePresetsChange()
	return { status: "saved", preset: savedPreset }
}

export function saveCommonWebsiteTab(tab: TabItem, storage?: Storage) {
	if (!isWebsiteTab(tab)) return { status: "invalid" } satisfies SaveCommonWebsitePresetResult
	const { title, url, description } = getWebsiteTabData(tab)
	return saveCommonWebsitePreset({ title, url, description }, storage)
}

export function updateCommonWebsitePreset(
	presetId: string,
	preset: Pick<WebsitePreset, "url"> & Partial<Pick<WebsitePreset, "title" | "description">>,
	storage?: Storage,
) {
	const targetStorage = getCommonWebsiteStorage(storage)
	const url = normalizeWebsiteUrl(preset.url)
	if (!targetStorage || !url) return { status: "invalid" } satisfies SaveCommonWebsitePresetResult

	const existingPresets = getCommonWebsitePresets(targetStorage)
	const existingPreset = existingPresets.find((item) => item.id === presetId)
	if (!existingPreset) return { status: "invalid" } satisfies SaveCommonWebsitePresetResult
	const duplicatePreset = existingPresets.find(
		(item) => item.id !== presetId && normalizeWebsiteUrl(item.url)?.href === url.href,
	)
	if (duplicatePreset) {
		return { status: "exists", preset: duplicatePreset }
	}

	const savedPreset: WebsitePreset = {
		id: `common-${createWebsiteSlug(url)}`,
		title: preset.title?.trim() || url.hostname.replace(/^www\./, ""),
		url: url.href,
		description: preset.description?.trim() || undefined,
	}
	const nextPresets = [
		savedPreset,
		...existingPresets.filter((item) => item.id !== presetId),
	].slice(0, COMMON_WEBSITE_PRESETS_LIMIT)

	targetStorage.setItem(COMMON_WEBSITE_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets))
	emitCommonWebsitePresetsChange()
	return { status: "saved", preset: savedPreset }
}

export function removeCommonWebsitePreset(presetId: string, storage?: Storage) {
	const targetStorage = getCommonWebsiteStorage(storage)
	if (!targetStorage) return false

	const existingPresets = getCommonWebsitePresets(targetStorage)
	const nextPresets = existingPresets.filter((preset) => preset.id !== presetId)
	if (nextPresets.length === existingPresets.length) return false

	targetStorage.setItem(COMMON_WEBSITE_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets))
	emitCommonWebsitePresetsChange()
	return true
}

export function buildWebsiteTab(preset: WebsitePreset): TabItem {
	const tabId = `${WEBSITE_TAB_PREFIX}${preset.id}`
	const title = preset.title || preset.titleKey || preset.id
	const description = preset.description || preset.descriptionKey
	const fileData: FileItem = {
		file_id: tabId,
		file_name: title,
		display_filename: title,
		url: preset.url,
		display_config: {
			type: "website",
			name: title,
			description,
			previewPolicy: {
				persistTab: true,
				syncWithAttachments: false,
				restoreAsActive: true,
			},
		},
	}

	return {
		id: tabId,
		type: "website",
		title,
		fileData,
		active: true,
		closeable: true,
		display_config: fileData.display_config,
	}
}

export function isWebsiteTab(
	tab: (Pick<TabItem, "id"> & Partial<Pick<TabItem, "type" | "fileData">>) | null | undefined,
) {
	return tab?.type === "website" || tab?.id.startsWith(WEBSITE_TAB_PREFIX) === true
}

export function getWebsiteTabData(tab: Partial<Pick<TabItem, "title" | "fileData">>) {
	return {
		title: tab.fileData?.display_config?.name || tab.title || "",
		url: tab.fileData?.url || "",
		description:
			typeof tab.fileData?.display_config?.description === "string"
				? tab.fileData.display_config.description
				: undefined,
	}
}
