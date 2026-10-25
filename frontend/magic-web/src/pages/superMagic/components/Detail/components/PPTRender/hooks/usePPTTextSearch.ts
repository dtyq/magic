import { useEffect, useRef, useState } from "react"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { PPTStore } from "../stores/PPTStore"
import {
	PPTFileMutationError,
	type PPTFileSnapshot,
	type createPPTFileMutationClient,
} from "../services/pptFileMutation"
import {
	applySlideTextReplacements,
	createSlideTextSearchSnapshot,
	type SlideTextSearchSnapshot,
} from "../utils/slideTextSearch"

export interface PPTTextSearchOptions {
	open: boolean
	deckKey: string
	store: PPTStore
	selectedIds: ReadonlySet<string>
	allowEdit: boolean
	busy: boolean
	client: ReturnType<typeof createPPTFileMutationClient>
	runWrite: (operation: () => Promise<void>) => Promise<void>
	onNavigate: (index: number) => Promise<void>
}

export interface PPTSearchPage {
	fileId: string
	path: string
	page: number
	snapshot?: PPTFileSnapshot
	search?: SlideTextSearchSnapshot
	failed?: boolean
}

export type PPTSearchOutcome = "success" | "conflict" | "unknown" | "failed" | "cancelled"
export interface PPTSearchReplacement {
	page: PPTSearchPage
	content: string
	matchIds: readonly number[]
	outcome?: PPTSearchOutcome
}

/** Source fetching and writes share one captured editor identity, never an array index. */
export function usePPTTextSearch(options: PPTTextSearchOptions) {
	const { open, deckKey, store, selectedIds, allowEdit, client, runWrite, onNavigate, busy } =
		options
	const fileApi = useFileApi()
	const [query, setQuery] = useState("")
	const [replacement, setReplacement] = useState("")
	const [scope, setScope] = useState<"all" | "selected">("all")
	const [caseSensitive, setCaseSensitive] = useState(false)
	const [pages, setPages] = useState<PPTSearchPage[]>([])
	const [scanning, setScanning] = useState(false)
	const [progress, setProgress] = useState({ done: 0, total: 0 })
	const [activeKey, setActiveKey] = useState<string | null>(null)
	const [phase, setPhase] = useState<"search" | "preview" | "done">("search")
	const [plan, setPlan] = useState<PPTSearchReplacement[]>([])
	const [saving, setSaving] = useState(false)
	const [cancelled, setCancelled] = useState(false)
	const [error, setError] = useState(false)
	const [refreshFailed, setRefreshFailed] = useState(false)
	const [reload, setReload] = useState(0)
	const generation = useRef(0)
	const batch = useRef<{ cancelled: boolean }>()
	const latest = useRef(options)
	latest.current = options
	// Read only small slide identities, never serialize attachments or HTML in render.
	const slidesKey = store.slides
		.map((slide) => `${store.getFileIdByPath(slide.path) || ""}\0${slide.path}`)
		.join("\n")
	const selectionKey = scope === "selected" ? [...selectedIds].sort().join("\0") : ""

	useEffect(() => {
		const controller = new AbortController()
		generation.current += 1
		if (batch.current) batch.current.cancelled = true
		setPages([])
		setPlan([])
		setPhase("search")
		setActiveKey(null)
		setError(false)
		setProgress({ done: 0, total: 0 })
		setScanning(Boolean(open && query))
		if (!open || !query) return () => controller.abort()
		const targets = store.slides
			.map((slide, index) => ({
				fileId: store.getFileIdByPath(slide.path) || "",
				path: slide.path,
				page: index + 1,
			}))
			.filter((slide) => scope === "all" || latest.current.selectedIds.has(slide.fileId))
		const timer = setTimeout(() => {
			setProgress({ done: 0, total: targets.length })
			let next = 0
			const results: PPTSearchPage[] = []
			async function worker() {
				while (next < targets.length && !controller.signal.aborted) {
					const target = targets[next++]
					let result: PPTSearchPage = target
					try {
						if (!target.fileId) throw new Error("Missing slide identity")
						const snapshot = allowEdit
							? await client.read(target.fileId, controller.signal)
							: undefined
						const content = snapshot
							? snapshot.content
							: await fileApi.getFileContentById(target.fileId, {
									responseType: "text",
									forceRefresh: true,
									signal: controller.signal,
								})
						if (typeof content !== "string") throw new Error("Invalid slide source")
						if (controller.signal.aborted) return
						result = {
							...target,
							snapshot,
							search: createSlideTextSearchSnapshot(content, query, {
								caseSensitive,
							}),
						}
					} catch {
						if (controller.signal.aborted) return
						result = { ...target, failed: true }
					}
					results.push(result)
					setPages([...results].sort((a, b) => a.page - b.page))
					setProgress({ done: results.length, total: targets.length })
				}
			}
			void Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker)).finally(
				() => {
					if (!controller.signal.aborted) setScanning(false)
				},
			)
		}, 250)
		return () => {
			clearTimeout(timer)
			controller.abort()
		}
	}, [
		open,
		deckKey,
		store,
		slidesKey,
		selectionKey,
		scope,
		query,
		caseSensitive,
		fileApi,
		client,
		allowEdit,
		reload,
	])

	useEffect(
		() => () => {
			generation.current += 1
			if (batch.current) batch.current.cancelled = true
		},
		[],
	)

	const matches = pages.flatMap((page) =>
		(page.search?.matches || []).map((match) => ({ page, match })),
	)
	// Earlier pages can arrive after the user navigates a result. Keep focus bound
	// to that file/match rather than to the changing position in the result list.
	const active = Math.max(
		0,
		matches.findIndex(({ page, match }) => `${page.fileId}\0${match.id}` === activeKey),
	)
	const current = matches[active]
	async function navigate(index: number) {
		const hit = matches[index]
		if (!hit) return
		const currentIndex = store.slides.findIndex(
			(slide) => store.getFileIdByPath(slide.path) === hit.page.fileId,
		)
		if (currentIndex < 0) {
			setError(true)
			return
		}
		const startedGeneration = generation.current
		try {
			await onNavigate(currentIndex)
			if (generation.current === startedGeneration)
				setActiveKey(`${hit.page.fileId}\0${hit.match.id}`)
		} catch {
			if (generation.current === startedGeneration) setError(true)
		}
	}

	function preview(all: boolean) {
		if (!allowEdit || busy || saving || scanning) return
		const selected = all ? matches : current ? [current] : []
		if (
			!selected.length ||
			selected.some(({ page, match }) => !page.snapshot || !match.replaceable)
		)
			return
		const grouped = new Map<PPTSearchPage, number[]>()
		for (const { page, match } of selected)
			grouped.set(page, [...(grouped.get(page) || []), match.id])
		try {
			setPlan(
				[...grouped].map(([page, matchIds]) => {
					if (!page.search || !page.snapshot) throw new Error("Missing search baseline")
					return {
						page,
						matchIds,
						content: applySlideTextReplacements(
							page.search,
							page.snapshot.content,
							replacement,
							matchIds,
						),
					}
				}),
			)
			setPhase("preview")
			setError(false)
		} catch {
			setError(true)
		}
	}

	async function confirm() {
		if (!allowEdit || busy || batch.current || phase !== "preview" || !plan.length) return
		const operation = { cancelled: false }
		batch.current = operation
		const startGeneration = generation.current
		const isCurrent = () =>
			generation.current === startGeneration &&
			latest.current.open &&
			latest.current.deckKey === deckKey &&
			latest.current.client === client &&
			latest.current.allowEdit
		setSaving(true)
		setCancelled(false)
		setRefreshFailed(false)
		const results = plan.map((entry) => ({ ...entry }))
		try {
			await runWrite(async () => {
				for (const entry of results) {
					if (operation.cancelled || !isCurrent()) {
						entry.outcome = "cancelled"
						continue
					}
					const stillExists = store.slides.some(
						(slide) => store.getFileIdByPath(slide.path) === entry.page.fileId,
					)
					if (!stillExists || !entry.page.snapshot) {
						entry.outcome = "conflict"
						continue
					}
					try {
						// Keep the exact client-issued object: recreating it loses its revision provenance.
						await client.save(entry.page.snapshot, entry.content)
						entry.outcome = "success"
						if (isCurrent()) {
							try {
								await store.refreshSlideByFileId(entry.page.fileId)
							} catch {
								if (isCurrent()) setRefreshFailed(true)
							}
						}
					} catch (cause) {
						entry.outcome =
							cause instanceof PPTFileMutationError
								? cause.kind === "stale"
									? "cancelled"
									: cause.kind
								: "failed"
						if (entry.outcome === "unknown" || entry.outcome === "cancelled")
							operation.cancelled = true
					}
					if (isCurrent()) setPlan(results.map((result) => ({ ...result })))
				}
			})
		} catch {
			if (isCurrent()) setError(true)
		} finally {
			batch.current = undefined
			if (isCurrent()) {
				setPlan(
					results.map((entry) => ({ ...entry, outcome: entry.outcome || "cancelled" })),
				)
				setPhase("done")
			}
			setSaving(false)
		}
	}

	return {
		query,
		setQuery,
		replacement,
		setReplacement,
		scope,
		setScope,
		caseSensitive,
		setCaseSensitive,
		pages,
		matches,
		current,
		active,
		navigate,
		scanning,
		progress,
		phase,
		plan,
		preview,
		confirm,
		saving,
		cancelled,
		error,
		refreshFailed,
		cancel: () => {
			if (batch.current) {
				batch.current.cancelled = true
				setCancelled(true)
			}
		},
		back: () => {
			if (!saving) setPhase("search")
		},
		rescan: () => setReload((value) => value + 1),
	}
}
