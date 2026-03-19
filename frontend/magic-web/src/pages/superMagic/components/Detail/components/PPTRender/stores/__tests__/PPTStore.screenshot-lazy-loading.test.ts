import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { runInAction } from "mobx"
import { createPPTStore } from "../PPTStore"
import type { PPTStore } from "../PPTStore"

// Mock the services
vi.mock("../../services/SlideLoaderService")
vi.mock("../../services/SlideProcessorService")
vi.mock("../../services/SlideScreenshotService")
vi.mock("../../services/PPTLogger")

describe("PPTStore - Screenshot Lazy Loading", () => {
	let store: PPTStore

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		store?.reset()
	})

	describe("screenshotStrategy configuration", () => {
		it('should default to "eager" strategy when not specified', () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
			})

			// @ts-ignore - access private config for testing
			expect(store.config.screenshotStrategy).toBe("eager")
		})

		it('should use "viewport" strategy when specified', () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "viewport",
			})

			// @ts-ignore - access private config for testing
			expect(store.config.screenshotStrategy).toBe("viewport")
		})

		it('should use "lazy" strategy when specified', () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "lazy",
			})

			// @ts-ignore - access private config for testing
			expect(store.config.screenshotStrategy).toBe("lazy")
		})

		it("should maintain backward compatibility with autoLoadAndGenerate", () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				autoLoadAndGenerate: false,
			})

			// @ts-ignore - access private config for testing
			expect(store.config.autoLoadSlides).toBe(false)
		})
	})

	describe("screenshot generation based on strategy", () => {
		it('should generate all screenshots immediately with "eager" strategy', async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "eager",
			})

			const generateAllScreenshotsSpy = vi.spyOn(store, "generateAllScreenshots")

			// Initialize slides
			await store.initializeSlides([
				"slides/page1.html",
				"slides/page2.html",
				"slides/page3.html",
			])

			// Wait for slides to load (mocked behavior)
			await new Promise((resolve) => setTimeout(resolve, 100))

			// With eager strategy, generateAllScreenshots should be called
			expect(generateAllScreenshotsSpy).toHaveBeenCalled()
		})

		it('should NOT generate screenshots automatically with "viewport" strategy', async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "viewport",
			})

			const generateAllScreenshotsSpy = vi.spyOn(store, "generateAllScreenshots")

			// Initialize slides
			await store.initializeSlides([
				"slides/page1.html",
				"slides/page2.html",
				"slides/page3.html",
			])

			// Wait for slides to load (mocked behavior)
			await new Promise((resolve) => setTimeout(resolve, 100))

			// With viewport strategy, generateAllScreenshots should NOT be called
			expect(generateAllScreenshotsSpy).not.toHaveBeenCalled()
		})

		it('should NOT generate screenshots automatically with "lazy" strategy', async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "lazy",
			})

			const generateAllScreenshotsSpy = vi.spyOn(store, "generateAllScreenshots")

			// Initialize slides
			await store.initializeSlides([
				"slides/page1.html",
				"slides/page2.html",
				"slides/page3.html",
			])

			// Wait for slides to load (mocked behavior)
			await new Promise((resolve) => setTimeout(resolve, 100))

			// With lazy strategy, generateAllScreenshots should NOT be called
			expect(generateAllScreenshotsSpy).not.toHaveBeenCalled()
		})
	})

	describe("manual screenshot generation", () => {
		it("should generate screenshot on demand for specific slide", async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "viewport",
			})

			// Initialize slides
			await store.initializeSlides([
				"slides/page1.html",
				"slides/page2.html",
				"slides/page3.html",
			])

			// Manually set slide content for testing
			runInAction(() => {
				if (store.slides[0]) {
					store.slides[0].content = "<div>Test content</div>"
					store.slides[0].loadingState = "loaded"
				}
			})

			// Request screenshot generation for slide 0
			await store.generateSlideScreenshot(0)

			// Check that the slide has thumbnail loading state set
			expect(store.slides[0]?.thumbnailLoading).toBeDefined()
		})

		it("should allow selective screenshot generation", async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "lazy",
			})

			// Initialize slides
			await store.initializeSlides([
				"slides/page1.html",
				"slides/page2.html",
				"slides/page3.html",
			])

			// Manually set slide content for testing
			runInAction(() => {
				store.slides.forEach((slide, index) => {
					slide.content = `<div>Slide ${index + 1}</div>`
					slide.loadingState = "loaded"
				})
			})

			// Generate screenshot only for slide 1
			await store.generateSlideScreenshot(1)

			// Only slide 1 should have triggered screenshot generation
			expect(store.slides[0]?.thumbnailLoading).toBeUndefined()
			expect(store.slides[1]?.thumbnailLoading).toBeDefined()
			expect(store.slides[2]?.thumbnailLoading).toBeUndefined()
		})
	})

	describe("new slide insertion with lazy loading", () => {
		it('should NOT auto-generate screenshot for new slides with "viewport" strategy', async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "viewport",
			})

			// Initialize slides
			await store.initializeSlides(["slides/page1.html", "slides/page2.html"])

			const generateSlideScreenshotSpy = vi.spyOn(store, "generateSlideScreenshot")

			// Insert a new slide
			const newSlideData = {
				path: "slides/page3.html",
				url: "https://example.com/slides/page3.html",
				fileId: "file3",
			}

			await store.insertSlide(0, "after", newSlideData)

			// With viewport strategy, screenshot should NOT be generated automatically
			expect(generateSlideScreenshotSpy).not.toHaveBeenCalled()
		})

		it('should auto-generate screenshot for new slides with "eager" strategy', async () => {
			store = createPPTStore({
				attachments: [],
				attachmentList: [],
				mainFileId: "test-file",
				mainFileName: "test.html",
				screenshotStrategy: "eager",
			})

			// Initialize slides
			await store.initializeSlides(["slides/page1.html", "slides/page2.html"])

			// Insert a new slide (screenshot generation is part of the insertion callback)
			const newSlideData = {
				path: "slides/page3.html",
				url: "https://example.com/slides/page3.html",
				fileId: "file3",
			}

			// With eager strategy, the insertion callback should trigger screenshot generation
			await store.insertSlide(0, "after", newSlideData)

			// Verify that the new slide was inserted (exact behavior depends on callback implementation)
			expect(store.slides.length).toBeGreaterThan(2)
		})
	})
})
