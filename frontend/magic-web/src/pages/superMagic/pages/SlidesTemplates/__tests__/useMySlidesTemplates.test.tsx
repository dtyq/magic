import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { SlidesTemplateItem } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import type {
	MySlidesTemplateAdapter,
	MySlidesTemplatePage,
} from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import { useMySlidesTemplates } from "../useMySlidesTemplates"

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

function template(code: string): SlidesTemplateItem {
	return {
		code,
		label: { zh_CN: code, en_US: code },
		description: { zh_CN: "", en_US: "" },
		is_official: false,
	}
}

function page(items: SlidesTemplateItem[], pageNumber = 1): MySlidesTemplatePage {
	return {
		items,
		page: pageNumber,
		pageSize: 40,
		hasMore: items.length === 40,
	}
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

function createAdapter(overrides: Partial<MySlidesTemplateAdapter> = {}): MySlidesTemplateAdapter {
	return {
		enabled: true,
		saveEnabled: false,
		listMine: vi.fn(async () => page([])),
		listFavorites: vi.fn(async () => page([])),
		listUsed: vi.fn(async () => page([])),
		checkByCode: vi.fn(async () => ({ status: "UNUSED" })),
		loadDetail: vi.fn(async (code) => template(code)),
		favorite: vi.fn(async () => undefined),
		unfavorite: vi.fn(async () => undefined),
		remove: vi.fn(async () => undefined),
		saveFromFolder: vi.fn(async () => template("saved")),
		...overrides,
	}
}

describe("useMySlidesTemplates", () => {
	it("defaults to Created and ignores a stale request after switching sections", async () => {
		const createdRequest = createDeferred<MySlidesTemplatePage>()
		const adapter = createAdapter({
			listMine: vi.fn(() => createdRequest.promise),
			listFavorites: vi.fn(async () => page([template("PPT-favorite")])),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		expect(result.current.activeSection).toBe("created")
		act(() => result.current.select())
		await waitFor(() => expect(adapter.listMine).toHaveBeenCalled())
		act(() => result.current.setActiveSection("favorites"))
		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-favorite"))

		await act(async () => {
			createdRequest.resolve(page([template("PPT-created")]))
			await createdRequest.promise
		})

		expect(result.current.activeSection).toBe("favorites")
		expect(result.current.templates.map((item) => item.value)).toEqual(["PPT-favorite"])
	})

	it("invalidates the current request as soon as the search value changes", async () => {
		const initialRequest = createDeferred<MySlidesTemplatePage>()
		const adapter = createAdapter({
			listMine: vi
				.fn()
				.mockReturnValueOnce(initialRequest.promise)
				.mockResolvedValueOnce(page([template("PPT-new-search")])),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		act(() => result.current.select())
		await waitFor(() => expect(adapter.listMine).toHaveBeenCalledTimes(1))
		act(() => result.current.setSearchValue("new"))
		await act(async () => {
			initialRequest.resolve(page([template("PPT-stale")]))
			await initialRequest.promise
		})

		expect(result.current.templates).toEqual([])
		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-new-search"))
	})

	it("uses list length for pagination and keeps appended results without resetting the view", async () => {
		const firstPage = Array.from({ length: 40 }, (_, index) => template(`PPT-${index}`))
		const adapter = createAdapter({
			listMine: vi
				.fn()
				.mockResolvedValueOnce(page(firstPage))
				.mockResolvedValueOnce(page([template("PPT-next")], 2)),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		act(() => result.current.select())
		await waitFor(() => expect(result.current.hasMore).toBe(true))
		const resetKey = result.current.resetKey
		await act(async () => {
			await result.current.loadMore()
		})
		await waitFor(() => expect(result.current.templates).toHaveLength(41))

		expect(result.current.hasMore).toBe(false)
		expect(result.current.resetKey).toBe(resetKey)
		expect(adapter.listMine).toHaveBeenLastCalledWith({
			page: 2,
			pageSize: 40,
			keyword: undefined,
		})
	})

	it("keeps the current section loaded when its active filter is clicked again", async () => {
		const adapter = createAdapter({
			listMine: vi.fn(async () => page([template("PPT-created")])),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		act(() => result.current.select())
		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-created"))
		act(() => result.current.setActiveSection("created"))

		expect(result.current.emptyStatus).toBeNull()
		expect(result.current.templates[0]?.value).toBe("PPT-created")
		expect(adapter.listMine).toHaveBeenCalledTimes(1)
	})

	it("searches all recently used pages without sending an unsupported keyword", async () => {
		const firstPage = Array.from({ length: 200 }, (_, index) => template(`PPT-used-${index}`))
		const adapter = createAdapter({
			listUsed: vi.fn(async ({ page: pageNumber }) =>
				pageNumber === 1
					? {
							items: firstPage,
							page: 1,
							pageSize: 200,
							hasMore: true,
						}
					: {
							items: [template("PPT-quarterly")],
							page: 2,
							pageSize: 200,
							hasMore: false,
						},
			),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		act(() => result.current.select())
		await waitFor(() => expect(adapter.listMine).toHaveBeenCalled())
		act(() => result.current.setActiveSection("used"))
		act(() => result.current.setSearchValue("quarterly"))

		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-quarterly"))
		expect(adapter.listUsed).toHaveBeenCalledWith({ page: 1, pageSize: 200 })
		expect(adapter.listUsed).toHaveBeenCalledWith({ page: 2, pageSize: 200 })
		expect(result.current.hasMore).toBe(false)
	})

	it("does not roll a favorite update into a different active section", async () => {
		const adapter = createAdapter({
			listMine: vi.fn(async () => page([template("PPT-created")])),
			listFavorites: vi.fn(async () => page([template("PPT-favorite")])),
		})
		const { result } = renderHook(() => useMySlidesTemplates({ adapter, groups: [] }))

		act(() => result.current.select())
		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-created"))
		act(() => result.current.setActiveSection("favorites"))
		await waitFor(() => expect(result.current.templates[0]?.value).toBe("PPT-favorite"))
		act(() => result.current.setTemplateFavorite("created", "PPT-created", false, undefined))

		expect(result.current.templates.map((item) => item.value)).toEqual(["PPT-favorite"])
	})
})
