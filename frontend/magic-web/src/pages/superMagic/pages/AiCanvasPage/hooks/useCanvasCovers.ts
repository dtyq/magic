import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import {
	getFileMediaMetadata,
	type FileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"])
/** Covers load per project; a small pool keeps the home from flooding the attachments API. */
const MAX_CONCURRENT_LOADS = 3

/** Newest-first cover images: at most four fill a 2x2 grid. */
export const MAX_COVER_IMAGES = 4

/** null = project has no image yet; undefined = not resolved yet. */
export type CanvasCoverMap = Record<string, FileMediaMetadata[] | null | undefined>

// Keyed by project id + updated_at so an edited project resolves its newest image again,
// while returning to the home reuses covers that cannot have changed.
const coverCache = new Map<string, FileMediaMetadata[] | null>()

function getCoverCacheKey(project: ProjectListItem) {
	return `${project.id}:${project.updated_at ?? ""}`
}

function getTime(item: AttachmentItem) {
	const time = Date.parse(String(item.updated_at || item.created_at || ""))
	return Number.isNaN(time) ? 0 : time
}

/**
 * Picks up to four newest visible images of a canvas project for its cover. Hidden files and
 * files under dot-folders (for example `.tmp`) are runtime artifacts, not artwork.
 */
export function pickCanvasCovers(
	list: AttachmentItem[],
	projectId: string,
): FileMediaMetadata[] | null {
	const images = list.filter((item) => {
		if (item.is_directory || item.is_hidden) return false
		const extension = String(item.file_extension || item.file_name?.split(".").pop() || "")
			.replace(/^\./, "")
			.toLowerCase()
		if (!IMAGE_EXTENSIONS.has(extension)) return false
		return !String(item.relative_file_path || "")
			.split("/")
			.some((segment) => segment.startsWith("."))
	})
	if (images.length === 0) return null
	return [...images]
		.sort((left, right) => getTime(right) - getTime(left))
		.slice(0, MAX_COVER_IMAGES)
		.map((item) => getFileMediaMetadata(item, projectId))
		.filter((file): file is FileMediaMetadata => Boolean(file))
}

/**
 * Resolves cover images for the AI canvas projects whose cards have been on screen.
 *
 * Covers load lazily: a project is queued once its card first enters the viewport
 * (`visibleIds`), so a long list never reads attachments for cards nobody scrolled to. Reads go
 * through the shared attachments loader (same API and fallback as the file panel), at most three
 * at a time; later cards wait in the queue instead of cancelling earlier reads. Leaving the page
 * aborts pending reads; a failed read leaves the cover unresolved (placeholder) and is retried
 * the next time the card's project is queued.
 */
export function useCanvasCovers(
	projects: ProjectListItem[],
	visibleIds: ReadonlySet<string>,
): CanvasCoverMap {
	const [covers, setCovers] = useState<CanvasCoverMap>(() =>
		Object.fromEntries(
			projects.map((project) => [project.id, coverCache.get(getCoverCacheKey(project))]),
		),
	)
	const projectKey = projects.map(getCoverCacheKey).join(",")
	const controllerRef = useRef<AbortController | null>(null)
	const queueRef = useRef<ProjectListItem[]>([])
	// Cache keys queued or loading, so a card seen twice is read once.
	const pendingKeysRef = useRef(new Set<string>())
	const activeRef = useRef(0)

	useEffect(() => {
		const controller = new AbortController()
		controllerRef.current = controller
		return () => {
			controller.abort()
			controllerRef.current = null
			queueRef.current = []
			pendingKeysRef.current.clear()
			activeRef.current = 0
		}
	}, [])

	const pump = useMemoizedFn(() => {
		const controller = controllerRef.current
		if (!controller) return
		while (activeRef.current < MAX_CONCURRENT_LOADS && queueRef.current.length > 0) {
			const project = queueRef.current.shift()
			if (!project) break
			const key = getCoverCacheKey(project)
			activeRef.current += 1
			void loadProjectAttachments({
				projectId: project.id,
				signal: controller.signal,
				enableErrorMessagePrompt: false,
			})
				.then((result) => {
					if (controller.signal.aborted) return
					const cover = pickCanvasCovers(result.list, project.id)
					coverCache.set(key, cover)
					setCovers((current) => ({ ...current, [project.id]: cover }))
				})
				.catch(() => {
					// Keep the placeholder; nothing is cached, so a later queue retries it.
				})
				.finally(() => {
					pendingKeysRef.current.delete(key)
					if (controller.signal.aborted) return
					activeRef.current -= 1
					pump()
				})
		}
	})

	const visibleKey = projects
		.filter((project) => visibleIds.has(project.id))
		.map((project) => project.id)
		.join(",")

	useEffect(() => {
		setCovers((current) => {
			const next: CanvasCoverMap = {}
			for (const project of projects) {
				const cached = coverCache.get(getCoverCacheKey(project))
				next[project.id] = cached !== undefined ? cached : current[project.id]
			}
			return next
		})

		for (const project of projects) {
			const key = getCoverCacheKey(project)
			if (!visibleIds.has(project.id)) continue
			if (coverCache.has(key) || pendingKeysRef.current.has(key)) continue
			pendingKeysRef.current.add(key)
			queueRef.current.push(project)
		}
		pump()
		// projectKey and visibleKey capture every input that changes which covers are needed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectKey, visibleKey])

	return covers
}
