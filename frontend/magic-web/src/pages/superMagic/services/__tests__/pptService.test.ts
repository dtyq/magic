import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	collectFileIds: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
	getFileContentById: vi.fn(),
	loadSlide: vi.fn(),
	processSlideWithUrlMapping: vi.fn(),
	processorConfigs: [] as unknown[],
}))

vi.mock("@/pages/superMagic/components/Detail/components/PPTRender/services", () => ({
	SlideLoaderService: class {
		loadSlide = mocks.loadSlide
	},
	SlideProcessorService: class {
		constructor(config: unknown) {
			mocks.processorConfigs.push(config)
		}
		collectFileIds = mocks.collectFileIds
		processSlideWithUrlMapping = mocks.processSlideWithUrlMapping
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: mocks.getTemporaryDownloadUrl,
	getFileContentById: mocks.getFileContentById,
}))

import {
	iterateExportSlides,
	iterateSingleExportSlide,
	prepareExportSlides,
	resolvePptExportSlides,
} from "../pptService"

const slidePath = "./slides/slide-1.html"
const attachmentList = [
	{
		file_id: "main",
		file_name: "index.html",
		relative_file_path: "/deck/index.html",
	},
	{
		file_id: "slide-1",
		file_name: "slide-1.html",
		relative_file_path: "/deck/slides/slide-1.html",
	},
]

describe("pptService lazy export providers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.processorConfigs.length = 0
		mocks.collectFileIds.mockReturnValue(new Set())
		mocks.processSlideWithUrlMapping.mockImplementation(async (html: string) => html)
		mocks.getTemporaryDownloadUrl.mockImplementation(
			async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}`,
				})),
		)
	})

	it("cancels a single-slide provider while its HTML is loading", async () => {
		mocks.loadSlide.mockImplementation(() => new Promise(() => undefined))
		const controller = new AbortController()
		const iterator = iterateSingleExportSlide({
			fileId: "slide-1",
			fileName: "slide-1.html",
			attachmentList,
			signal: controller.signal,
		})[Symbol.asyncIterator]()
		const nextPage = iterator.next()
		await vi.waitFor(() => expect(mocks.loadSlide).toHaveBeenCalledOnce())

		controller.abort()

		await expect(nextPage).rejects.toMatchObject({ name: "AbortError" })
	})

	it("exports all authored build content without presentation visibility or scripts", async () => {
		const source = `<h1>Title</h1><p data-ppt-step="1">First</p><p data-ppt-step="2" data-ppt-effect="appear">Second</p>`
		mocks.loadSlide.mockResolvedValue(source)
		const pages = []
		for await (const page of iterateSingleExportSlide({
			fileId: "slide-1",
			fileName: "slide-1.html",
			attachmentList,
		}))
			pages.push(page)
		expect(pages[0].html).toBe(source)
		expect(pages[0].html).not.toContain("data-magic-ppt-build-hidden")
		expect(pages[0].html).not.toContain("ppt-build:set")
	})

	it("exports a single HTML file when no cancellation signal is provided", async () => {
		mocks.loadSlide.mockResolvedValue("<main>single</main>")

		const pages = []
		for await (const page of iterateSingleExportSlide({
			fileId: "slide-1",
			fileName: "slide-1.html",
			attachmentList,
		})) {
			pages.push(page)
		}

		expect(pages).toEqual([
			{
				index: 0,
				html: "<main>single</main>",
				key: "slide-1",
				pageName: "slide-1.html",
				pagePath: "slide-1.html",
				pageFileId: "slide-1",
			},
		])
	})

	it("does not convert an AbortError from a multi-slide loader into an empty page", async () => {
		mocks.loadSlide.mockRejectedValue(new DOMException("cancelled", "AbortError"))
		const iterator = iterateExportSlides({
			slidePaths: [slidePath],
			attachmentList,
			mainFileId: "main",
		})[Symbol.asyncIterator]()

		await expect(iterator.next()).rejects.toMatchObject({ name: "AbortError" })
	})

	it("skips an ordinary per-page failure without yielding a blank page", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
		mocks.loadSlide.mockRejectedValue(new Error("load failed"))
		const iterator = iterateExportSlides({
			slidePaths: [slidePath],
			attachmentList,
			mainFileId: "main",
		})[Symbol.asyncIterator]()

		await expect(iterator.next()).rejects.toThrow("No exportable slides could be prepared")
		expect(consoleError).toHaveBeenCalled()
	})

	it("keeps successful pages when another page fails to prepare", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const secondSlidePath = "./slides/slide-2.html"
		const attachments = [
			...attachmentList,
			{
				file_id: "slide-2",
				file_name: "slide-2.html",
				relative_file_path: "/deck/slides/slide-2.html",
			},
		]
		mocks.loadSlide
			.mockRejectedValueOnce(new Error("load failed"))
			.mockResolvedValueOnce("<main>second</main>")

		const pages = []
		for await (const page of iterateExportSlides({
			slidePaths: [slidePath, secondSlidePath],
			attachmentList: attachments,
			mainFileId: "main",
		})) {
			pages.push(page)
		}

		expect(pages).toEqual([
			{
				index: 1,
				key: secondSlidePath,
				html: "<main>second</main>",
				pageName: "slide-2.html",
				pagePath: secondSlidePath,
				pageFileId: "slide-2",
			},
		])
		expect(consoleError).toHaveBeenCalled()
	})

	it("passes the bound file API to slide processing during export", async () => {
		mocks.loadSlide.mockResolvedValue("<main>slide</main>")
		const fileApi = {
			identityKey: "share:test",
			getTemporaryDownloadUrl: vi
				.fn()
				.mockResolvedValue([
					{ file_id: "slide-1", url: "https://share.example.com/slide-1.html" },
				]),
			getFileContentById: vi.fn(),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		}

		const iterator = iterateExportSlides({
			slidePaths: [slidePath],
			attachmentList,
			mainFileId: "main",
			fileApi,
		})[Symbol.asyncIterator]()

		await iterator.next()

		expect(mocks.processorConfigs).toContainEqual(expect.objectContaining({ fileApi }))
	})
})

describe("PPT export hidden configuration", () => {
	const configFile = {
		file_id: "config",
		file_name: "magic.project.js",
		relative_file_path: "/deck/magic.project.js",
	}
	it("reads canonical hidden paths with the bound file identity before requesting pages", async () => {
		const getFileContentById = vi
			.fn()
			.mockResolvedValue(
				`window.magicProjectConfig = { slides: ['${slidePath}'], hidden_slides: ['slides/slide-1.html'] };`,
			)
		const getTemporaryDownloadUrl = vi.fn()
		const fileApi = { getFileContentById, getTemporaryDownloadUrl } as any
		const input = {
			slidePaths: [slidePath],
			attachmentList: [...attachmentList, configFile],
			mainFileId: "main",
			fileApi,
		}
		expect((await prepareExportSlides(input)).htmlSlides).toEqual([])
		const pages = []
		for await (const page of iterateExportSlides(input)) pages.push(page)
		expect(pages).toEqual([])
		expect(getFileContentById).toHaveBeenCalledWith("config", {
			responseType: "text",
			access: undefined,
		})
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("does not revive stale metadata hidden pages when the source omits hidden_slides", async () => {
		const getFileContentById = vi
			.fn()
			.mockResolvedValue(`window.magicProjectConfig = { slides: ['${slidePath}'] };`)
		const resolved = await resolvePptExportSlides({
			slidePaths: [slidePath],
			displayConfig: { hidden_slides: [slidePath] },
			attachmentList: [...attachmentList, configFile],
			mainFileId: "main",
			fileApi: { getFileContentById } as any,
		})
		expect(resolved.slidePaths).toEqual([slidePath])
	})

	it("does not read a different deck's configuration by filename alone", async () => {
		const getFileContentById = vi.fn()
		const resolved = await resolvePptExportSlides({
			slidePaths: [slidePath],
			displayConfig: { hidden_slides: [slidePath] },
			attachmentList: [
				...attachmentList,
				{ ...configFile, relative_file_path: "/other/magic.project.js" },
			],
			mainFileId: "main",
			fileApi: { getFileContentById } as any,
		})
		expect(resolved.slidePaths).toEqual([])
		expect(getFileContentById).not.toHaveBeenCalled()
	})
})
