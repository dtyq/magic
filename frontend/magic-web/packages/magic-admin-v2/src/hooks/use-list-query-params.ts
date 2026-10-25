import { useDebounce } from "ahooks"
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { TEXT_FILTER_DEBOUNCE_MS } from "@magic-admin-v2/constants/filters"

export type StringKey<T> = {
	[K in keyof T]-?: T[K] extends string ? K : never
}[keyof T]

type ListPagination = {
	page: number
	pageSize: number
	resetKey: string
}

export type ListQueryParamsState<TDraft, TParams extends { page: number }> = {
	filterDraft: TDraft
	page: number
	params: TParams
	pageSize: number
	setDebouncedField: (field: StringKey<TDraft>, value: string) => void
	setFilterDraft: Dispatch<SetStateAction<TDraft>>
	setPage: (page: number) => void
	setPageSize: (pageSize: number) => void
}

const emptyDebounceFields: ReadonlyArray<never> = []

function appliedText(raw: string, debounced: string) {
	return raw ? debounced : ""
}

function readField<TDraft>(draft: TDraft, field: StringKey<TDraft> | undefined) {
	if (!field) return ""
	return String(draft[field] ?? "").trim()
}

/**
 * Derives list request params from a filter draft and page.
 * Debounced text fields apply independently; page resets without a sync effect.
 */
export function useListQueryParams<TDraft, TParams extends { page: number }>({
	debounceFields = emptyDebounceFields as ReadonlyArray<StringKey<TDraft>>,
	extraResetKey,
	initialDraft,
	initialPageSize = 20,
	toParams,
}: {
	debounceFields?: ReadonlyArray<StringKey<TDraft>>
	extraResetKey?: unknown
	initialDraft: TDraft | (() => TDraft)
	initialPageSize?: number
	toParams: (draft: TDraft, page: number, pageSize: number) => TParams
}) {
	if (debounceFields.length > 5) {
		throw new Error("useListQueryParams supports at most 5 debounceFields")
	}

	const [filterDraft, setFilterDraftState] = useState(initialDraft)
	const [pagination, setPagination] = useState<ListPagination>({
		page: 1,
		pageSize: initialPageSize,
		resetKey: "",
	})

	const field0 = debounceFields[0]
	const field1 = debounceFields[1]
	const field2 = debounceFields[2]
	const field3 = debounceFields[3]
	const field4 = debounceFields[4]
	const raw0 = readField(filterDraft, field0)
	const raw1 = readField(filterDraft, field1)
	const raw2 = readField(filterDraft, field2)
	const raw3 = readField(filterDraft, field3)
	const raw4 = readField(filterDraft, field4)
	const debounced0 = useDebounce(raw0, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const debounced1 = useDebounce(raw1, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const debounced2 = useDebounce(raw2, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const debounced3 = useDebounce(raw3, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const debounced4 = useDebounce(raw4, { wait: TEXT_FILTER_DEBOUNCE_MS })
	const applied0 = field0 ? appliedText(raw0, debounced0) : ""
	const applied1 = field1 ? appliedText(raw1, debounced1) : ""
	const applied2 = field2 ? appliedText(raw2, debounced2) : ""
	const applied3 = field3 ? appliedText(raw3, debounced3) : ""
	const applied4 = field4 ? appliedText(raw4, debounced4) : ""

	const appliedDraft = useMemo(() => {
		if (!field0) return filterDraft
		return {
			...filterDraft,
			...(field0 ? { [field0]: applied0 } : null),
			...(field1 ? { [field1]: applied1 } : null),
			...(field2 ? { [field2]: applied2 } : null),
			...(field3 ? { [field3]: applied3 } : null),
			...(field4 ? { [field4]: applied4 } : null),
		} as TDraft
	}, [
		applied0,
		applied1,
		applied2,
		applied3,
		applied4,
		field0,
		field1,
		field2,
		field3,
		field4,
		filterDraft,
	])

	const appliedTextKey = [applied0, applied1, applied2, applied3, applied4].join("\0")
	const resetKey =
		extraResetKey === undefined ? appliedTextKey : `${String(extraResetKey)}:${appliedTextKey}`
	const page = pagination.resetKey === resetKey ? pagination.page : 1
	const pageSize = pagination.pageSize

	const params = useMemo(
		() => toParams(appliedDraft, page, pageSize),
		[appliedDraft, page, pageSize, toParams],
	)

	const setFilterDraft = useCallback<Dispatch<SetStateAction<TDraft>>>(
		(updater) => {
			setFilterDraftState(updater)
			setPagination((current) => ({ page: 1, pageSize: current.pageSize, resetKey }))
		},
		[resetKey],
	)

	const setDebouncedField = useCallback((field: StringKey<TDraft>, value: string) => {
		setFilterDraftState((previous) => ({ ...previous, [field]: value }))
	}, [])

	const setPage = useCallback(
		(nextPage: number) => {
			setPagination((current) => ({ page: nextPage, pageSize: current.pageSize, resetKey }))
		},
		[resetKey],
	)
	const setPageSize = useCallback(
		(nextPageSize: number) => {
			setPagination({ page: 1, pageSize: nextPageSize, resetKey })
		},
		[resetKey],
	)

	return {
		filterDraft,
		page,
		params,
		pageSize,
		setDebouncedField,
		setFilterDraft,
		setPage,
		setPageSize,
	}
}
