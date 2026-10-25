import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	processHtmlContent: vi.fn(),
	inlineDashboardDataJs: vi.fn(),
	injectFetchInterceptorScript: vi.fn(),
	findMatchingFile: vi.fn(),
	downloadFileContent: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: mocks.processHtmlContent,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/dashboard/resourceVersioning", () => ({
	inlineDashboardDataJs: mocks.inlineDashboardDataJs,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/fetchInterceptor", () => ({
	injectFetchInterceptorScript: mocks.injectFetchInterceptorScript,
	POST_MESSAGE_TARGET_STRATEGIES: { SAME_ORIGIN_ANCESTOR: "same-origin-ancestor" },
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils", () => ({
	findMatchingFile: mocks.findMatchingFile,
}))
vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: mocks.downloadFileContent,
	getTemporaryDownloadUrl: mocks.getTemporaryDownloadUrl,
}))

import { iteratePreparedHtmlPages, prepareHtmlPagesForExport } from "../htmlExportPrepare"

describe("htmlExportPrepare page sources", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.processHtmlContent.mockImplementation(async ({ content }: { content: string }) => ({
			processedContent: `<!doctype html><html><body>${content}</body></html>`,
		}))
		mocks.injectFetchInterceptorScript.mockImplementation((html: string) => html)
	})

	it("prepares the AsyncIterable lazily in stable source order", async () => {
		const iterator = iteratePreparedHtmlPages({ pages: ["first", "second"] })[
			Symbol.asyncIterator
		]()
		expect(mocks.processHtmlContent).not.toHaveBeenCalled()

		const first = await iterator.next()
		expect(first.done).toBe(false)
		expect(first.value?.index).toBe(0)
		expect(first.value?.html).toContain("first")
		expect(mocks.processHtmlContent).toHaveBeenCalledTimes(1)

		const second = await iterator.next()
		expect(second.done).toBe(false)
		expect(second.value?.index).toBe(1)
		expect(second.value?.html).toContain("second")
		expect(mocks.processHtmlContent).toHaveBeenCalledTimes(2)
	})

	it("retains source page identity for export diagnostics", async () => {
		const iterator = iteratePreparedHtmlPages({
			pages: [
				{
					html: "first",
					index: 7,
					key: "slides/first.html",
					pageName: "first.html",
					pagePath: "slides/first.html",
					pageFileId: "file-1",
				},
			],
		})[Symbol.asyncIterator]()

		await expect(iterator.next()).resolves.toMatchObject({
			value: {
				index: 7,
				key: "slides/first.html",
				pageName: "first.html",
				pagePath: "slides/first.html",
				pageFileId: "file-1",
			},
		})
	})

	it("keeps the compatibility array API bounded to one preparation at a time", async () => {
		let activePreparations = 0
		let peakPreparations = 0
		mocks.processHtmlContent.mockImplementation(async ({ content }: { content: string }) => {
			activePreparations += 1
			peakPreparations = Math.max(peakPreparations, activePreparations)
			await Promise.resolve()
			activePreparations -= 1
			return { processedContent: `<html><body>${content}</body></html>` }
		})

		const pages = await prepareHtmlPagesForExport({ pages: ["one", "two", "three"] })

		expect(peakPreparations).toBe(1)
		expect(pages).toHaveLength(3)
		expect(pages[0]).toContain("one")
		expect(pages[1]).toContain("two")
		expect(pages[2]).toContain("three")
	})

	it("stops waiting for a pending page preparation when aborted", async () => {
		mocks.processHtmlContent.mockImplementation(() => new Promise(() => undefined))
		const controller = new AbortController()
		const iterator = iteratePreparedHtmlPages({
			pages: ["pending"],
			signal: controller.signal,
		})[Symbol.asyncIterator]()
		const nextPage = iterator.next()
		await vi.waitFor(() => expect(mocks.processHtmlContent).toHaveBeenCalledOnce())

		controller.abort()

		await expect(nextPage).rejects.toMatchObject({ name: "AbortError" })
	})
})
