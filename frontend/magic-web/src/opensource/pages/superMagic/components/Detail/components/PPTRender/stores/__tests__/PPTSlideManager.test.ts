import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PPTSlideManager } from "../PPTSlideManager"
import { createPPTLogger } from "../../services/PPTLoggerService"
import { PPTPathMappingService } from "../../services/PPTPathMappingService"
import { SlideScreenshotService } from "../../services/SlideScreenshotService"
import type { SlideItem } from "../../PPTSidebar/types"

describe("PPTSlideManager", () => {
	let slideManager: PPTSlideManager
	let logger: ReturnType<typeof createPPTLogger>
	let pathMappingService: PPTPathMappingService
	let screenshotService: SlideScreenshotService

	const createMockSlide = (
		index: number,
		path: string = `/slides/slide${index}.html`,
		url: string = `https://example.com/slide${index}.html`,
	): SlideItem => ({
		id: `slide-${index}`,
		path,
		url,
		index,
		loadingState: "idle",
	})

	beforeEach(() => {
		logger = createPPTLogger({ level: "silent" })
		pathMappingService = new PPTPathMappingService(logger)
		screenshotService = new SlideScreenshotService(logger)

		// Setup path mappings
		pathMappingService.setPathFileIdMapping("/slides/slide0.html", "file-0")
		pathMappingService.setPathFileIdMapping("/slides/slide1.html", "file-1")
		pathMappingService.setPathFileIdMapping("/slides/slide2.html", "file-2")
		pathMappingService.setPathUrlMapping(
			"/slides/slide0.html",
			"https://example.com/slide0.html",
		)
		pathMappingService.setPathUrlMapping(
			"/slides/slide1.html",
			"https://example.com/slide1.html",
		)
		pathMappingService.setPathUrlMapping(
			"/slides/slide2.html",
			"https://example.com/slide2.html",
		)

		slideManager = new PPTSlideManager(logger, pathMappingService, screenshotService, true)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	// ==================== Initialization ====================
	describe("Initialization", () => {
		it("should initialize with default values", () => {
			expect(slideManager.slides).toEqual([])
			expect(slideManager.activeIndex).toBe(0)
			expect(slideManager.isTransitioning).toBe(false)
			expect(slideManager.totalSlides).toBe(0)
		})

		it("should have syncManager initialized", () => {
			expect(slideManager.syncManager).toBeDefined()
			expect(slideManager.syncManager.isPending).toBe(false)
		})
	})

	// ==================== Computed Values ====================
	describe("Computed Values", () => {
		beforeEach(() => {
			const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
			slideManager.initializeSlides(slides)
		})

		it("should compute slideUrls correctly", () => {
			expect(slideManager.slideUrls).toEqual([
				"https://example.com/slide0.html",
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
			])
		})

		it("should compute slidePaths correctly", () => {
			expect(slideManager.slidePaths).toEqual([
				"/slides/slide0.html",
				"/slides/slide1.html",
				"/slides/slide2.html",
			])
		})

		it("should compute slideTitles correctly", () => {
			expect(slideManager.slideTitles).toEqual(["Slide 1", "Slide 2", "Slide 3"])

			slideManager.updateSlideTitle(0, "Custom Title")
			expect(slideManager.slideTitles[0]).toBe("Custom Title")
		})

		it("should compute currentSlide correctly", () => {
			slideManager.setActiveIndex(1)
			expect(slideManager.currentSlide).toEqual(slideManager.slides[1])
		})

		it("should compute currentSlideUrl correctly", () => {
			slideManager.setActiveIndex(1)
			expect(slideManager.currentSlideUrl).toBe("https://example.com/slide1.html")
		})

		it("should compute currentSlidePath correctly", () => {
			slideManager.setActiveIndex(1)
			expect(slideManager.currentSlidePath).toBe("/slides/slide1.html")
		})

		it("should compute currentSlideTitle correctly", () => {
			slideManager.setActiveIndex(1)
			expect(slideManager.currentSlideTitle).toBe("Slide 2")

			slideManager.updateSlideTitle(1, "Custom Title")
			expect(slideManager.currentSlideTitle).toBe("Custom Title")
		})

		it("should compute currentSlideContent correctly", () => {
			slideManager.updateSlideContent(1, "<div>Test Content</div>")
			slideManager.setActiveIndex(1)
			expect(slideManager.currentSlideContent).toBe("<div>Test Content</div>")
		})

		it("should compute currentFileId correctly", () => {
			slideManager.setActiveIndex(1)
			expect(slideManager.currentFileId).toBe("file-1")
		})

		it("should compute totalSlides correctly", () => {
			expect(slideManager.totalSlides).toBe(3)
		})

		it("should return empty values when no slides exist", () => {
			slideManager.reset()
			expect(slideManager.currentSlide).toBeUndefined()
			expect(slideManager.currentSlideUrl).toBe("")
			expect(slideManager.currentSlidePath).toBe("")
			expect(slideManager.currentSlideTitle).toBe("Slide 1")
			expect(slideManager.currentSlideContent).toBe("")
			expect(slideManager.currentFileId).toBe("")
		})
	})

	// ==================== Basic Actions ====================
	describe("Basic Actions", () => {
		describe("initializeSlides", () => {
			it("should initialize slides from slide items", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				expect(slideManager.slides).toEqual(slides)
				expect(slideManager.activeIndex).toBe(0)
				expect(slideManager.isTransitioning).toBe(false)
			})

			it("should reset state on initialization", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1)
				slideManager.setIsTransitioning(true)

				slideManager.initializeSlides([createMockSlide(0)])

				expect(slideManager.activeIndex).toBe(0)
				expect(slideManager.isTransitioning).toBe(false)
			})
		})

		describe("setActiveIndex", () => {
			beforeEach(() => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
			})

			it("should set active index within valid range", () => {
				slideManager.setActiveIndex(1)
				expect(slideManager.activeIndex).toBe(1)

				slideManager.setActiveIndex(2)
				expect(slideManager.activeIndex).toBe(2)
			})

			it("should not set negative index", () => {
				slideManager.setActiveIndex(1)
				slideManager.setActiveIndex(-1)
				expect(slideManager.activeIndex).toBe(1)
			})

			it("should not set index beyond slides length", () => {
				slideManager.setActiveIndex(1)
				slideManager.setActiveIndex(10)
				expect(slideManager.activeIndex).toBe(1)
			})

			it("should not change if index is the same", () => {
				slideManager.setActiveIndex(1)
				const spy = vi.spyOn(logger, "debug")
				slideManager.setActiveIndex(1)
				expect(slideManager.activeIndex).toBe(1)
				expect(spy).not.toHaveBeenCalled()
			})
		})

		describe("setIsTransitioning", () => {
			it("should set transition state", () => {
				slideManager.setIsTransitioning(true)
				expect(slideManager.isTransitioning).toBe(true)

				slideManager.setIsTransitioning(false)
				expect(slideManager.isTransitioning).toBe(false)
			})
		})
	})

	// ==================== Navigation ====================
	describe("Navigation", () => {
		beforeEach(() => {
			const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
			slideManager.initializeSlides(slides)
		})

		describe("canGoPrev / canGoNext", () => {
			it("should compute canGoPrev correctly", () => {
				slideManager.setActiveIndex(0)
				expect(slideManager.canGoPrev).toBe(false)

				slideManager.setActiveIndex(1)
				expect(slideManager.canGoPrev).toBe(true)

				slideManager.setActiveIndex(2)
				expect(slideManager.canGoPrev).toBe(true)
			})

			it("should compute canGoNext correctly", () => {
				slideManager.setActiveIndex(0)
				expect(slideManager.canGoNext).toBe(true)

				slideManager.setActiveIndex(1)
				expect(slideManager.canGoNext).toBe(true)

				slideManager.setActiveIndex(2)
				expect(slideManager.canGoNext).toBe(false)
			})

			it("should not allow navigation while transitioning", () => {
				slideManager.setActiveIndex(1)
				slideManager.setIsTransitioning(true)

				expect(slideManager.canGoPrev).toBe(false)
				expect(slideManager.canGoNext).toBe(false)
			})
		})

		describe("nextSlide", () => {
			it("should navigate to next slide", () => {
				slideManager.setActiveIndex(0)
				slideManager.nextSlide()
				expect(slideManager.activeIndex).toBe(1)
			})

			it("should not navigate past last slide", () => {
				slideManager.setActiveIndex(2)
				slideManager.nextSlide()
				expect(slideManager.activeIndex).toBe(2)
			})

			it("should not navigate while transitioning", () => {
				slideManager.setActiveIndex(0)
				slideManager.setIsTransitioning(true)
				slideManager.nextSlide()
				expect(slideManager.activeIndex).toBe(0)
			})
		})

		describe("prevSlide", () => {
			it("should navigate to previous slide", () => {
				slideManager.setActiveIndex(1)
				slideManager.prevSlide()
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should not navigate before first slide", () => {
				slideManager.setActiveIndex(0)
				slideManager.prevSlide()
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should not navigate while transitioning", () => {
				slideManager.setActiveIndex(1)
				slideManager.setIsTransitioning(true)
				slideManager.prevSlide()
				expect(slideManager.activeIndex).toBe(1)
			})
		})

		describe("goToFirstSlide", () => {
			it("should go to first slide", () => {
				slideManager.setActiveIndex(2)
				slideManager.goToFirstSlide()
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should do nothing if already at first slide", () => {
				slideManager.setActiveIndex(0)
				slideManager.goToFirstSlide()
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should not navigate while transitioning", () => {
				slideManager.setActiveIndex(2)
				slideManager.setIsTransitioning(true)
				slideManager.goToFirstSlide()
				expect(slideManager.activeIndex).toBe(2)
			})
		})
	})

	// ==================== Slide Sync ====================
	describe("Slide Synchronization", () => {
		describe("syncSlides - No Changes", () => {
			it("should skip sync when paths are identical", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				const result = slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slide1.html",
				])

				expect(result.hasChanges).toBe(false)
				expect(result.changeType).toBeUndefined()
				expect(slideManager.slides.length).toBe(2)
			})
		})

		describe("syncSlides - Insert", () => {
			it("should handle incremental insert at beginning", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				const result = slideManager.syncSlides([
					"/slides/slideNew.html",
					"/slides/slide0.html",
					"/slides/slide1.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("insert")
				expect(result.affectedIndices).toEqual([0])
				expect(slideManager.slides.length).toBe(3)
				expect(slideManager.slides[0].path).toBe("/slides/slideNew.html")
			})

			it("should handle incremental insert in middle", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				const result = slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slideNew.html",
					"/slides/slide1.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("insert")
				expect(result.affectedIndices).toEqual([1])
				expect(slideManager.slides.length).toBe(3)
				expect(slideManager.slides[1].path).toBe("/slides/slideNew.html")
			})

			it("should adjust activeIndex when inserting before current slide", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slideNew.html",
					"/slides/slide1.html",
					"/slides/slide2.html",
				])

				expect(slideManager.activeIndex).toBe(2) // Adjusted from 1 to 2
			})

			it("should handle multiple inserts at once", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew1.html",
					"https://example.com/slideNew1.html",
				)
				pathMappingService.setPathUrlMapping(
					"/slides/slideNew2.html",
					"https://example.com/slideNew2.html",
				)
				pathMappingService.setPathUrlMapping(
					"/slides/slideNew3.html",
					"https://example.com/slideNew3.html",
				)

				const result = slideManager.syncSlides([
					"/slides/slideNew1.html",
					"/slides/slide0.html",
					"/slides/slideNew2.html",
					"/slides/slide1.html",
					"/slides/slideNew3.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("insert")
				expect(result.affectedIndices).toEqual([0, 2, 4])
				expect(slideManager.slides.length).toBe(5)
				expect(slideManager.slides[0].path).toBe("/slides/slideNew1.html")
				expect(slideManager.slides[2].path).toBe("/slides/slideNew2.html")
				expect(slideManager.slides[4].path).toBe("/slides/slideNew3.html")
			})

			it("should adjust activeIndex correctly with multiple inserts before current", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(2)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew1.html",
					"https://example.com/slideNew1.html",
				)
				pathMappingService.setPathUrlMapping(
					"/slides/slideNew2.html",
					"https://example.com/slideNew2.html",
				)

				slideManager.syncSlides([
					"/slides/slideNew1.html",
					"/slides/slide0.html",
					"/slides/slideNew2.html",
					"/slides/slide1.html",
					"/slides/slide2.html",
				])

				expect(slideManager.activeIndex).toBe(4) // Adjusted from 2 to 4 (inserted 2 slides before)
			})
		})

		describe("syncSlides - Delete", () => {
			it("should handle incremental delete at beginning", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)

				const result = slideManager.syncSlides([
					"/slides/slide1.html",
					"/slides/slide2.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("delete")
				expect(result.affectedIndices).toEqual([0])
				expect(slideManager.slides.length).toBe(2)
				expect(slideManager.slides[0].path).toBe("/slides/slide1.html")
			})

			it("should handle incremental delete in middle", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)

				const result = slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slide2.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("delete")
				expect(result.affectedIndices).toEqual([1])
				expect(slideManager.slides.length).toBe(2)
				expect(slideManager.slides[1].path).toBe("/slides/slide2.html")
			})

			it("should adjust activeIndex when deleting before current slide", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(2)

				slideManager.syncSlides(["/slides/slide1.html", "/slides/slide2.html"])

				expect(slideManager.activeIndex).toBe(1) // Adjusted from 2 to 1
			})

			it("should adjust activeIndex when deleting current slide", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1)

				slideManager.syncSlides(["/slides/slide0.html", "/slides/slide2.html"])

				expect(slideManager.activeIndex).toBe(1) // Stays at 1 (now pointing to slide2)
			})

			it("should handle multiple deletes at once", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
					createMockSlide(4),
				]
				slideManager.initializeSlides(slides)

				const result = slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slide3.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("delete")
				expect(result.affectedIndices).toEqual([1, 2, 4])
				expect(slideManager.slides.length).toBe(2)
				expect(slideManager.slides[0].path).toBe("/slides/slide0.html")
				expect(slideManager.slides[1].path).toBe("/slides/slide3.html")
			})

			it("should adjust activeIndex correctly with multiple deletes before current", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
					createMockSlide(4),
				]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(4)

				slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slide3.html",
					"/slides/slide4.html",
				])

				expect(slideManager.activeIndex).toBe(2) // Adjusted from 4 to 2 (deleted 2 slides before)
			})

			it("should adjust activeIndex when deleting the active slide in a batch", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
				]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(2)

				slideManager.syncSlides(["/slides/slide0.html", "/slides/slide3.html"])

				expect(slideManager.activeIndex).toBe(1) // Active slide deleted, moved to next available
			})
		})

		describe("syncSlides - Reorder", () => {
			it("should handle reorder with same slides", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2, "/slides/slide2.html"),
				]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1)

				const result = slideManager.syncSlides([
					"/slides/slide2.html",
					"/slides/slide0.html",
					"/slides/slide1.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("reorder")
				expect(slideManager.slides.length).toBe(3)
				expect(slideManager.slides[0].path).toBe("/slides/slide2.html")
				expect(slideManager.slides[1].path).toBe("/slides/slide0.html")
				expect(slideManager.slides[2].path).toBe("/slides/slide1.html")
			})

			it("should track activeIndex during reorder", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1) // Active slide is slide1

				slideManager.syncSlides([
					"/slides/slide2.html",
					"/slides/slide1.html",
					"/slides/slide0.html",
				])

				expect(slideManager.activeIndex).toBe(1) // Still points to slide1 at new position
				expect(slideManager.currentSlidePath).toBe("/slides/slide1.html")
			})
		})

		describe("syncSlides - Mixed (Insert + Delete)", () => {
			it("should handle mixed operations with some slides preserved", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
				]
				slideManager.initializeSlides(slides)

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew1.html",
					"https://example.com/slideNew1.html",
				)
				pathMappingService.setPathUrlMapping(
					"/slides/slideNew2.html",
					"https://example.com/slideNew2.html",
				)

				const result = slideManager.syncSlides([
					"/slides/slide0.html", // kept
					"/slides/slideNew1.html", // inserted
					"/slides/slide2.html", // kept
					"/slides/slideNew2.html", // inserted
					// slide1 and slide3 deleted
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("mixed")
				expect(slideManager.slides.length).toBe(4)
				expect(slideManager.slides[0].path).toBe("/slides/slide0.html")
				expect(slideManager.slides[1].path).toBe("/slides/slideNew1.html")
				expect(slideManager.slides[2].path).toBe("/slides/slide2.html")
				expect(slideManager.slides[3].path).toBe("/slides/slideNew2.html")
			})

			it("should preserve active slide when still exists after mixed operations", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
				]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(2) // Active on slide2

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slideNew.html",
					"/slides/slide2.html", // Active slide preserved
					// slide1 and slide3 deleted
				])

				expect(slideManager.activeIndex).toBe(2) // Active slide moved to new position
				expect(slideManager.currentSlidePath).toBe("/slides/slide2.html")
			})

			it("should adjust activeIndex when active slide is deleted in mixed operations", () => {
				const slides = [
					createMockSlide(0),
					createMockSlide(1),
					createMockSlide(2),
					createMockSlide(3),
				]
				slideManager.initializeSlides(slides)
				slideManager.setActiveIndex(1) // Active on slide1

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				slideManager.syncSlides([
					"/slides/slide0.html",
					"/slides/slideNew.html",
					"/slides/slide3.html",
					// slide1 (active) and slide2 deleted
				])

				expect(slideManager.activeIndex).toBe(1) // Moved to nearest available
			})

			it("should reuse existing slide objects for preserved slides", () => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)

				const originalSlide0 = slideManager.slides[0]
				const originalSlide2 = slideManager.slides[2]

				pathMappingService.setPathUrlMapping(
					"/slides/slideNew.html",
					"https://example.com/slideNew.html",
				)

				slideManager.syncSlides([
					"/slides/slide0.html", // kept
					"/slides/slideNew.html", // inserted
					"/slides/slide2.html", // kept
					// slide1 deleted
				])

				// Verify that existing slides are reused (same id)
				expect(slideManager.slides[0].id).toBe(originalSlide0.id)
				expect(slideManager.slides[2].id).toBe(originalSlide2.id)
				// New slide has different id
				expect(slideManager.slides[1].id).not.toBe(originalSlide0.id)
				expect(slideManager.slides[1].id).not.toBe(originalSlide2.id)
			})
		})

		describe("syncSlides - Replace", () => {
			it("should handle full replace with completely different slides", () => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)

				pathMappingService.setPathUrlMapping(
					"/slides/slideA.html",
					"https://example.com/slideA.html",
				)
				pathMappingService.setPathUrlMapping(
					"/slides/slideB.html",
					"https://example.com/slideB.html",
				)

				const result = slideManager.syncSlides([
					"/slides/slideA.html",
					"/slides/slideB.html",
				])

				expect(result.hasChanges).toBe(true)
				expect(result.changeType).toBe("replace")
				expect(slideManager.slides.length).toBe(2)
				expect(slideManager.activeIndex).toBe(0) // Reset to first slide
			})
		})
	})

	// ==================== Content Updates ====================
	describe("Content Updates", () => {
		beforeEach(() => {
			const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
			slideManager.initializeSlides(slides)
		})

		describe("updateSlideContent", () => {
			it("should update slide content and loading state", () => {
				slideManager.updateSlideContent(1, "<div>Content</div>")

				expect(slideManager.slides[1].content).toBe("<div>Content</div>")
				expect(slideManager.slides[1].loadingState).toBe("loaded")
			})

			it("should not update with invalid index", () => {
				slideManager.updateSlideContent(-1, "content")
				slideManager.updateSlideContent(10, "content")
				// Should not throw
			})
		})

		describe("updateSlideContents", () => {
			it("should batch update multiple slide contents", () => {
				const updates = new Map([
					[0, "<div>Content 0</div>"],
					[1, "<div>Content 1</div>"],
					[2, "<div>Content 2</div>"],
				])

				slideManager.updateSlideContents(updates)

				expect(slideManager.slides[0].content).toBe("<div>Content 0</div>")
				expect(slideManager.slides[1].content).toBe("<div>Content 1</div>")
				expect(slideManager.slides[2].content).toBe("<div>Content 2</div>")
			})
		})

		describe("updateSlideTitle", () => {
			it("should update slide title", () => {
				slideManager.updateSlideTitle(1, "Custom Title")

				expect(slideManager.slides[1].title).toBe("Custom Title")
			})
		})

		describe("updateSlideTitles", () => {
			it("should batch update slide titles", () => {
				const titles = ["Title 0", "Title 1", "Title 2"]

				slideManager.updateSlideTitles(titles)

				expect(slideManager.slides[0].title).toBe("Title 0")
				expect(slideManager.slides[1].title).toBe("Title 1")
				expect(slideManager.slides[2].title).toBe("Title 2")
			})

			it("should handle partial title updates", () => {
				const titles = ["Title 0"]

				slideManager.updateSlideTitles(titles)

				expect(slideManager.slides[0].title).toBe("Title 0")
				expect(slideManager.slides[1].title).toBeUndefined()
			})
		})

		describe("updateSlideItem", () => {
			it("should update partial slide item properties", () => {
				slideManager.updateSlideItem(1, {
					title: "New Title",
					content: "New Content",
					loadingState: "loaded",
				})

				expect(slideManager.slides[1].title).toBe("New Title")
				expect(slideManager.slides[1].content).toBe("New Content")
				expect(slideManager.slides[1].loadingState).toBe("loaded")
				expect(slideManager.slides[1].path).toBe("/slides/slide1.html") // Preserved
			})

			it("should not update with invalid index", () => {
				slideManager.updateSlideItem(-1, { title: "Test" })
				slideManager.updateSlideItem(10, { title: "Test" })
				// Should not throw
			})
		})
	})

	// ==================== setSlides ====================
	describe("setSlides", () => {
		it("should update slides with SlideItem array", () => {
			const newSlides = [createMockSlide(0), createMockSlide(1)]

			slideManager.setSlides(newSlides)

			expect(slideManager.slides).toEqual(newSlides)
		})

		it("should convert string array to SlideItem array", () => {
			const initialSlides = [createMockSlide(0), createMockSlide(1)]
			slideManager.initializeSlides(initialSlides)

			const urls = ["https://new.com/slide0.html", "https://new.com/slide1.html"]

			slideManager.setSlides(urls)

			expect(slideManager.slides.length).toBe(2)
			expect(slideManager.slides[0].url).toBe(urls[0])
			expect(slideManager.slides[1].url).toBe(urls[1])
		})

		it("should handle empty array", () => {
			const slides = [createMockSlide(0), createMockSlide(1)]
			slideManager.initializeSlides(slides)

			slideManager.setSlides([])

			expect(slideManager.slides).toEqual([])
		})

		it("should record change for sync by default", () => {
			const spy = vi.spyOn(slideManager.syncManager, "recordChange")
			const newSlides = [createMockSlide(0)]

			slideManager.setSlides(newSlides)

			expect(spy).toHaveBeenCalledWith(newSlides)
		})

		it("should skip sync recording when skipSync is true", () => {
			const spy = vi.spyOn(slideManager.syncManager, "recordChange")
			const newSlides = [createMockSlide(0)]

			slideManager.setSlides(newSlides, true)

			expect(spy).not.toHaveBeenCalled()
		})
	})

	// ==================== CRUD Operations ====================
	describe("CRUD Operations", () => {
		describe("insertSlide", () => {
			beforeEach(() => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)
			})

			it("should insert slide before specified position", async () => {
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}

				const insertIndex = await slideManager.insertSlide(1, "before", newSlideData)

				expect(insertIndex).toBe(1)
				expect(slideManager.slides.length).toBe(3)
				expect(slideManager.slides[1].path).toBe("/slides/slideNew.html")
				expect(slideManager.slides[1].url).toBe("https://example.com/slideNew.html")
			})

			it("should insert slide after specified position", async () => {
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}

				const insertIndex = await slideManager.insertSlide(0, "after", newSlideData)

				expect(insertIndex).toBe(1)
				expect(slideManager.slides.length).toBe(3)
				expect(slideManager.slides[1].path).toBe("/slides/slideNew.html")
			})

			it("should update path mappings on insert", async () => {
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}

				await slideManager.insertSlide(0, "after", newSlideData)

				expect(pathMappingService.getFileIdByPath("/slides/slideNew.html")).toBe("file-new")
				expect(pathMappingService.getUrlByPath("/slides/slideNew.html")).toBe(
					"https://example.com/slideNew.html",
				)
			})

			it("should update slide indices after insert", async () => {
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}

				await slideManager.insertSlide(0, "after", newSlideData)

				expect(slideManager.slides[0].index).toBe(0)
				expect(slideManager.slides[1].index).toBe(1)
				expect(slideManager.slides[2].index).toBe(2)
			})

			it("should call onLoad callback when autoLoadAndGenerate is true", async () => {
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}
				const onLoad = vi.fn().mockResolvedValue(undefined)

				await slideManager.insertSlide(0, "after", newSlideData, onLoad)

				expect(onLoad).toHaveBeenCalledWith("https://example.com/slideNew.html", 1)
			})

			it("should not call onLoad when autoLoadAndGenerate is false", async () => {
				const managerWithoutAutoLoad = new PPTSlideManager(
					logger,
					pathMappingService,
					screenshotService,
					false,
				)
				const slides = [createMockSlide(0), createMockSlide(1)]
				managerWithoutAutoLoad.initializeSlides(slides)

				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}
				const onLoad = vi.fn().mockResolvedValue(undefined)

				await managerWithoutAutoLoad.insertSlide(0, "after", newSlideData, onLoad)

				expect(onLoad).not.toHaveBeenCalled()
			})

			it("should record change for sync", async () => {
				const spy = vi.spyOn(slideManager.syncManager, "recordChange")
				const newSlideData = {
					path: "/slides/slideNew.html",
					url: "https://example.com/slideNew.html",
					fileId: "file-new",
				}

				await slideManager.insertSlide(0, "after", newSlideData)

				expect(spy).toHaveBeenCalled()
			})
		})

		describe("deleteSlide", () => {
			beforeEach(() => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
			})

			it("should delete slide at specified index", () => {
				slideManager.deleteSlide(1)

				expect(slideManager.slides.length).toBe(2)
				expect(slideManager.slides[0].path).toBe("/slides/slide0.html")
				expect(slideManager.slides[1].path).toBe("/slides/slide2.html")
			})

			it("should update slide indices after deletion", () => {
				slideManager.deleteSlide(0)

				expect(slideManager.slides[0].index).toBe(0)
				expect(slideManager.slides[1].index).toBe(1)
			})

			it("should adjust activeIndex when deleting current slide", () => {
				slideManager.setActiveIndex(1)

				const newActiveIndex = slideManager.deleteSlide(1)

				expect(newActiveIndex).toBe(0) // Go to previous slide
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should adjust activeIndex when deleting slide before current", () => {
				slideManager.setActiveIndex(2)

				const newActiveIndex = slideManager.deleteSlide(0)

				expect(newActiveIndex).toBe(1) // Adjusted from 2 to 1
				expect(slideManager.activeIndex).toBe(1)
			})

			it("should not adjust activeIndex when deleting slide after current", () => {
				slideManager.setActiveIndex(0)

				const newActiveIndex = slideManager.deleteSlide(2)

				expect(newActiveIndex).toBeUndefined()
				expect(slideManager.activeIndex).toBe(0)
			})

			it("should not adjust activeIndex when adjustActiveIndex is false", () => {
				slideManager.setActiveIndex(1)

				const newActiveIndex = slideManager.deleteSlide(1, false)

				expect(newActiveIndex).toBeUndefined()
			})

			it("should throw error when deleting last slide", () => {
				slideManager.reset()
				slideManager.initializeSlides([createMockSlide(0)])

				expect(() => slideManager.deleteSlide(0)).toThrow("Cannot delete the last slide")
			})

			it("should throw error with invalid index", () => {
				expect(() => slideManager.deleteSlide(-1)).toThrow("Invalid slide index")
				expect(() => slideManager.deleteSlide(10)).toThrow("Invalid slide index")
			})

			it("should clear screenshot cache for deleted slide", () => {
				const spy = vi.spyOn(screenshotService, "clearCache")

				slideManager.deleteSlide(1)

				expect(spy).toHaveBeenCalledWith("https://example.com/slide1.html")
			})

			it("should record change for sync", () => {
				const spy = vi.spyOn(slideManager.syncManager, "recordChange")

				slideManager.deleteSlide(1)

				expect(spy).toHaveBeenCalled()
			})
		})

		describe("sortSlides", () => {
			beforeEach(() => {
				const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
				slideManager.initializeSlides(slides)
			})

			it("should sort slides in new order", () => {
				const newOrder = [
					slideManager.slides[2],
					slideManager.slides[0],
					slideManager.slides[1],
				]

				slideManager.sortSlides(newOrder)

				expect(slideManager.slides[0].path).toBe("/slides/slide2.html")
				expect(slideManager.slides[1].path).toBe("/slides/slide0.html")
				expect(slideManager.slides[2].path).toBe("/slides/slide1.html")
			})

			it("should update slide indices after sort", () => {
				const newOrder = [
					slideManager.slides[2],
					slideManager.slides[0],
					slideManager.slides[1],
				]

				slideManager.sortSlides(newOrder)

				expect(slideManager.slides[0].index).toBe(0)
				expect(slideManager.slides[1].index).toBe(1)
				expect(slideManager.slides[2].index).toBe(2)
			})

			it("should follow active slide to new position when moved", () => {
				slideManager.setActiveIndex(1)
				const activeSlideId = slideManager.slides[1].id

				const newOrder = [
					slideManager.slides[1], // Move active slide to first
					slideManager.slides[0],
					slideManager.slides[2],
				]

				slideManager.sortSlides(newOrder)

				expect(slideManager.activeIndex).toBe(0) // Active slide moved to index 0
				expect(slideManager.slides[0].id).toBe(activeSlideId)
			})

			it("should track original active slide when not moved", () => {
				slideManager.setActiveIndex(0)
				const activeSlideId = slideManager.slides[0].id

				const newOrder = [
					slideManager.slides[0], // Active slide stays first
					slideManager.slides[2], // Move slide2 to second
					slideManager.slides[1], // Move slide1 to third
				]

				slideManager.sortSlides(newOrder)

				expect(slideManager.activeIndex).toBe(0) // Active slide still at index 0
				expect(slideManager.slides[0].id).toBe(activeSlideId)
			})

			it("should throw error when slide count mismatch", () => {
				const newOrder = [slideManager.slides[0]]

				expect(() => slideManager.sortSlides(newOrder)).toThrow(
					"Slide count mismatch during sort",
				)
			})

			it("should record change for sync", () => {
				const spy = vi.spyOn(slideManager.syncManager, "recordChange")
				const newOrder = [
					slideManager.slides[2],
					slideManager.slides[0],
					slideManager.slides[1],
				]

				slideManager.sortSlides(newOrder)

				expect(spy).toHaveBeenCalled()
			})
		})

		describe("renameSlide", () => {
			beforeEach(() => {
				const slides = [createMockSlide(0), createMockSlide(1)]
				slideManager.initializeSlides(slides)
			})

			it("should rename slide path", () => {
				slideManager.renameSlide(1, "/slides/slideRenamed.html")

				expect(slideManager.slides[1].path).toBe("/slides/slideRenamed.html")
			})

			it("should update path mappings on rename", () => {
				slideManager.renameSlide(1, "/slides/slideRenamed.html")

				expect(pathMappingService.getFileIdByPath("/slides/slideRenamed.html")).toBe(
					"file-1",
				)
				expect(pathMappingService.getUrlByPath("/slides/slideRenamed.html")).toBe(
					"https://example.com/slide1.html",
				)
			})

			it("should throw error with invalid index", () => {
				expect(() => slideManager.renameSlide(-1, "newPath")).toThrow("Invalid slide index")
				expect(() => slideManager.renameSlide(10, "newPath")).toThrow("Invalid slide index")
			})

			it("should record change for sync", () => {
				const spy = vi.spyOn(slideManager.syncManager, "recordChange")

				slideManager.renameSlide(1, "/slides/slideRenamed.html")

				expect(spy).toHaveBeenCalled()
			})
		})
	})

	// ==================== Loading State ====================
	describe("Loading State", () => {
		it("should compute loading percentage correctly", () => {
			const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
			slideManager.initializeSlides(slides)

			expect(slideManager.loadingPercentage).toBe(0) // 0/3 loaded

			slideManager.updateSlideContent(0, "content")
			expect(slideManager.loadingPercentage).toBe(33) // 1/3 loaded

			slideManager.updateSlideContent(1, "content")
			expect(slideManager.loadingPercentage).toBe(67) // 2/3 loaded

			slideManager.updateSlideContent(2, "content")
			expect(slideManager.loadingPercentage).toBe(100) // 3/3 loaded
		})

		it("should return 0% when no slides exist", () => {
			expect(slideManager.loadingPercentage).toBe(0)
		})
	})

	// ==================== Reset ====================
	describe("Reset", () => {
		it("should reset to initial state", () => {
			const slides = [createMockSlide(0), createMockSlide(1)]
			slideManager.initializeSlides(slides)
			slideManager.setActiveIndex(1)
			slideManager.setIsTransitioning(true)
			slideManager.updateSlideContent(0, "content")

			slideManager.reset()

			expect(slideManager.slides).toEqual([])
			expect(slideManager.activeIndex).toBe(0)
			expect(slideManager.isTransitioning).toBe(false)
		})

		it("should clear sync manager", () => {
			const spy = vi.spyOn(slideManager.syncManager, "clear")

			slideManager.reset()

			expect(spy).toHaveBeenCalled()
		})
	})

	// ==================== Integration Tests ====================
	describe("Integration Tests", () => {
		it("should handle complete slide lifecycle", async () => {
			// Initialize
			const slides = [createMockSlide(0), createMockSlide(1)]
			slideManager.initializeSlides(slides)

			// Navigate
			slideManager.nextSlide()
			expect(slideManager.activeIndex).toBe(1)

			// Insert
			const newSlideData = {
				path: "/slides/slideNew.html",
				url: "https://example.com/slideNew.html",
				fileId: "file-new",
			}
			await slideManager.insertSlide(1, "before", newSlideData)
			expect(slideManager.slides.length).toBe(3)
			// Note: insertSlide doesn't auto-adjust activeIndex, so it remains 1
			expect(slideManager.activeIndex).toBe(1)

			// Update content
			slideManager.updateSlideContent(1, "<div>New Content</div>")
			expect(slideManager.slides[1].content).toBe("<div>New Content</div>")

			// Delete
			slideManager.deleteSlide(0)
			expect(slideManager.slides.length).toBe(2)
			expect(slideManager.activeIndex).toBe(0) // Adjusted from 1 to 0 after deleting slide before current

			// Reset
			slideManager.reset()
			expect(slideManager.slides).toEqual([])
		})

		it("should maintain data consistency during complex operations", () => {
			const slides = [createMockSlide(0), createMockSlide(1), createMockSlide(2)]
			slideManager.initializeSlides(slides)

			// Sort
			const newOrder = [slides[2], slides[0], slides[1]]
			slideManager.sortSlides(newOrder)

			// Verify indices are correct
			slideManager.slides.forEach((slide, index) => {
				expect(slide.index).toBe(index)
			})

			// Verify total slides
			expect(slideManager.totalSlides).toBe(3)

			// Verify computed values
			expect(slideManager.slideUrls.length).toBe(3)
			expect(slideManager.slidePaths.length).toBe(3)
			expect(slideManager.slideTitles.length).toBe(3)
		})
	})
})
