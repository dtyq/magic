import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { RecycleBinApi } from "@/apis"
import type { RecycleBin } from "@/apis/modules/recycle-bin"
import { mapRecycleBinItem, type RecycleBinItem } from "./recycle-bin-domain"
import {
	createRecycleBinTimeRange,
	parseRecycleBinTime,
	type RecycleBinFileView,
	type RecycleBinSearchPeriod,
	type RecycleBinTimeRange,
} from "./recycle-bin-file-view"

type SearchStatus =
	| "idle"
	| "loading"
	| "ready"
	| "searching"
	| "limit"
	| "error"
	| "invalid"
	| "cancelled"
	| "stale"
const PAGE_SIZE = 50

/** 同一项目的普通游标浏览与有限搜索；只有完整且未超限的搜索结果才能交给展示层。 */
export function useRecycleBinSearch({
	projectId,
	keyword,
	view,
}: {
	projectId?: string
	keyword: string
	view: RecycleBinFileView
}) {
	const { t } = useTranslation("super")
	const bounded = view === "location" || keyword.trim() !== ""
	const scopeKey = [
		projectId ?? "",
		bounded ? "search" : "browse",
		keyword.trim(),
		view === "location",
	].join("\0")
	const [items, setItems] = useState<RecycleBinItem[]>([])
	const [resultScope, setResultScope] = useState("")
	const [status, setStatus] = useState<SearchStatus>("idle")
	const [limits, setLimits] = useState<RecycleBin.SearchLimits | null>(null)
	const [range, setRange] = useState<RecycleBinTimeRange | null>(null)
	const [period, setPeriod] = useState<RecycleBinSearchPeriod>("recent")
	const [submittedRange, setSubmittedRange] = useState<RecycleBinTimeRange | null>(null)
	const [progress, setProgress] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [moreError, setMoreError] = useState(false)
	const [total, setTotal] = useState<number | null>(null)
	const [resultVersion, setResultVersion] = useState(0)
	const controller = useRef<AbortController | null>(null)
	const countController = useRef<AbortController | null>(null)
	const epoch = useRef(0)
	const cursor = useRef<string | null>(null)
	const mounted = useRef(true)
	const rangeHours = range
		? parseRecycleBinTime(range.end).diff(parseRecycleBinTime(range.start), "hour", true)
		: NaN
	const invalidRange =
		!limits || !Number.isFinite(rangeHours) || rangeHours <= 0 || rangeHours > limits.max_hours

	const cancelRequest = useMemoizedFn(() => {
		epoch.current += 1
		controller.current?.abort()
		controller.current = null
	})
	const refreshTotal = useMemoizedFn(async () => {
		countController.current?.abort()
		if (!projectId) return
		const request = new AbortController()
		countController.current = request
		try {
			const counts = await RecycleBinApi.getRecycleBinCounts(
				{ project_id: projectId },
				request.signal,
			)
			if (mounted.current && !request.signal.aborted)
				setTotal(counts.find((item) => item.resource_type === 4)?.count ?? 0)
		} catch {
			if (mounted.current && !request.signal.aborted) setTotal(null)
		}
	})
	const resetResult = useMemoizedFn(() => {
		cancelRequest()
		setItems([])
		setResultScope(scopeKey)
		setSubmittedRange(null)
		setStatus("idle")
		setHasMore(false)
		setLoadingMore(false)
		setMoreError(false)
		setProgress(0)
		cursor.current = null
	})
	const loadPage = useMemoizedFn(async (replace = false) => {
		if (!projectId || bounded || controller.current || (!replace && !hasMore)) return
		const request = new AbortController()
		controller.current = request
		const version = epoch.current
		if (replace) setStatus("loading")
		else setLoadingMore(true)
		setMoreError(false)
		try {
			const data = await RecycleBinApi.getProjectRecycleBinList(
				{
					project_id: projectId,
					resource_type: 4,
					include_total: false,
					page_size: PAGE_SIZE,
					cursor: replace ? undefined : (cursor.current ?? undefined),
				},
				request.signal,
			)
			if (request.signal.aborted || version !== epoch.current) return
			if (data.has_more && (!data.next_cursor || data.next_cursor === cursor.current))
				throw new Error("Invalid recycle bin cursor")
			setLimits(data.search_limits)
			setRange(
				(previous) => previous ?? createRecycleBinTimeRange(data.search_limits.max_hours),
			)
			const next = data.list.map((item) => mapRecycleBinItem(item, t))
			setItems((previous) => {
				if (replace) return next
				const ids = new Set(previous.map((item) => item.id))
				return [...previous, ...next.filter((item) => !ids.has(item.id))]
			})
			cursor.current = data.next_cursor
			setResultScope(scopeKey)
			setHasMore(data.has_more)
			setStatus("ready")
		} catch {
			if (!request.signal.aborted && version === epoch.current) {
				if (replace) setStatus("error")
				else setMoreError(true)
			}
		} finally {
			if (version === epoch.current) {
				controller.current = null
				setLoadingMore(false)
			}
		}
	})

	const runSearch = useMemoizedFn(async () => {
		if (!projectId || !limits || !bounded || status === "searching") return
		const queryRange =
			period === "custom"
				? range
				: createRecycleBinTimeRange(period === "recent" ? limits.max_hours : period)
		resetResult()
		if (!queryRange?.start || !queryRange.end) {
			setStatus("invalid")
			return
		}
		const start = parseRecycleBinTime(queryRange.start)
		const end = parseRecycleBinTime(queryRange.end)
		const hours = end.diff(start, "hour", true)
		if (!start.isValid() || !end.isValid() || hours <= 0 || hours > limits.max_hours) {
			setStatus("invalid")
			return
		}
		setRange(queryRange)
		setSubmittedRange(queryRange)
		setStatus("searching")
		const request = new AbortController()
		controller.current = request
		const version = epoch.current
		const collected = new Map<string, RecycleBinItem>()
		const seenCursors = new Set<string>()
		let nextCursor: string | undefined
		let received = 0
		try {
			do {
				const data = await RecycleBinApi.getProjectRecycleBinList(
					{
						project_id: projectId,
						resource_type: 4,
						include_total: false,
						keyword: keyword.trim() || undefined,
						deleted_from: start.format("YYYY-MM-DDTHH:mm:ssZ"),
						deleted_to: end.format("YYYY-MM-DDTHH:mm:ssZ"),
						page_size: Math.min(PAGE_SIZE, limits.max_results + 1 - received),
						cursor: nextCursor,
					},
					request.signal,
				)
				if (request.signal.aborted || version !== epoch.current) return
				received += data.list.length
				setProgress(Math.min(received, limits.max_results))
				if (received > limits.max_results) {
					setStatus("limit")
					return
				}
				for (const item of data.list) collected.set(item.id, mapRecycleBinItem(item, t))
				if (!data.has_more) break
				if (
					!data.next_cursor ||
					seenCursors.has(data.next_cursor) ||
					data.list.length === 0
				)
					throw new Error("Invalid recycle bin cursor")
				seenCursors.add(data.next_cursor)
				nextCursor = data.next_cursor
			} while (!request.signal.aborted)
			// 中间批次仅更新进度；完成后一次交付结果，避免把半个目录误报为完整分类。
			setItems([...collected.values()])
			setResultScope(scopeKey)
			setStatus("ready")
			setResultVersion((value) => value + 1)
		} catch {
			if (!request.signal.aborted && version === epoch.current) setStatus("error")
		} finally {
			if (version === epoch.current) controller.current = null
		}
	})
	const changePeriod = useMemoizedFn((next: RecycleBinSearchPeriod) => {
		if (
			typeof next === "number" &&
			(!limits || !Number.isFinite(next) || next <= 0 || next > limits.max_hours)
		)
			return
		resetResult()
		setPeriod(next)
		if (next !== "custom" && limits)
			setRange(createRecycleBinTimeRange(next === "recent" ? limits.max_hours : next))
	})
	const changeRange = useMemoizedFn((next: RecycleBinTimeRange) => {
		resetResult()
		setPeriod("custom")
		setRange(next)
	})
	const cancelSearch = useMemoizedFn(() => {
		resetResult()
		setStatus("cancelled")
	})
	const refresh = useMemoizedFn(() => {
		void refreshTotal()
		if (bounded) {
			cancelRequest()
			setStatus("stale")
		} else {
			resetResult()
			void loadPage(true)
		}
	})
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			cancelRequest()
			countController.current?.abort()
		}
	}, [cancelRequest])
	useEffect(() => {
		setTotal(null)
		setLimits(null)
		setRange(null)
		setPeriod("recent")
		void refreshTotal()
		return () => countController.current?.abort()
	}, [projectId, refreshTotal])
	useEffect(() => {
		resetResult()
		if (!bounded) void loadPage(true)
		return cancelRequest
	}, [scopeKey, bounded, cancelRequest, loadPage, resetResult])

	return {
		items: resultScope === scopeKey ? items : [],
		setItems,
		total,
		limits,
		range,
		invalidRange,
		period,
		status,
		bounded,
		scopeKey,
		submittedRange,
		progress,
		resultVersion,
		hasMore: !bounded && hasMore,
		loadingMore,
		moreError,
		loadMore: () => loadPage(),
		retry: () => (bounded ? runSearch() : loadPage(true)),
		runSearch,
		changePeriod,
		changeRange,
		cancelSearch,
		refresh,
	}
}
