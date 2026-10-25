import { ElementTypeEnum } from "../../../document/types"
import type { ConnectionOrigin } from "../../../shared/connectionOrigin"
import type { SelectionContentSnapshot } from "../selectionContentCollector"
import {
	getAllowedConnectionMenuCreateKinds,
	isConnectionMenuCreateKindAllowed,
	isConnectionMenuSideDisabled,
} from "../connectionMenuCapabilities"

function createSnapshot(
	types: Array<SelectionContentSnapshot["items"][number]["type"]>,
	options?: { imageSequence?: string[] },
): SelectionContentSnapshot {
	return {
		rootElementIds: types.map((_, index) => `element-${index}`),
		items: types.map((type, index) => ({
			elementId: `element-${index}`,
			type,
			rootElementId: `element-${index}`,
			ready: true,
			mainReady: true,
		})),
		imageSequence: options?.imageSequence ?? [],
		videoSequence: [],
		mainVideoSequence: [],
		audioSequence: [],
		counts: { image: 0, video: 0, audio: 0, text: 0 },
		boundingRect: null,
		selectionRevision: "revision",
		allRootsCanConnect: true,
	}
}

function context(side: "left" | "right", snapshot: SelectionContentSnapshot) {
	const origin: ConnectionOrigin = {
		kind: "element",
		elementId: "origin",
		side,
	}
	return {
		origin,
		snapshot,
	}
}

describe("connection menu capabilities", () => {
	it.each([
		[ElementTypeEnum.Image, true],
		[ElementTypeEnum.Video, false],
		[ElementTypeEnum.Audio, false],
		[ElementTypeEnum.Text, true],
	])("filters image generation from right-side %s sources", (type, allowed) => {
		const snapshot = createSnapshot([type], {
			imageSequence: type === ElementTypeEnum.Image ? ["element-0"] : [],
		})
		expect(
			isConnectionMenuCreateKindAllowed(context("right", snapshot), "image-generator"),
		).toBe(allowed)
	})

	it("allows image generation for mixed image and text sources", () => {
		const snapshot = createSnapshot([ElementTypeEnum.Image, ElementTypeEnum.Text], {
			imageSequence: ["element-0"],
		})
		expect(getAllowedConnectionMenuCreateKinds(context("right", snapshot))).toEqual([
			"text",
			"image-generator",
			"video-generator",
		])
	})

	it("rejects mixed image and video/audio sources for image generation", () => {
		for (const type of [ElementTypeEnum.Video, ElementTypeEnum.Audio]) {
			const snapshot = createSnapshot([ElementTypeEnum.Image, type], {
				imageSequence: ["element-0"],
			})
			expect(
				isConnectionMenuCreateKindAllowed(context("right", snapshot), "image-generator"),
			).toBe(false)
		}
	})

	it("rejects an image without usable downstream content", () => {
		const snapshot = createSnapshot([ElementTypeEnum.Image])
		expect(
			isConnectionMenuCreateKindAllowed(context("right", snapshot), "image-generator"),
		).toBe(false)
	})

	it("preserves conservative left-side behavior", () => {
		const snapshot = createSnapshot([ElementTypeEnum.Video])
		expect(
			isConnectionMenuCreateKindAllowed(context("left", snapshot), "image-generator"),
		).toBe(true)
	})

	it("disables every left-side menu item for audio sources", () => {
		const snapshot = createSnapshot([ElementTypeEnum.Audio])
		expect(getAllowedConnectionMenuCreateKinds(context("left", snapshot))).toEqual([])
		expect(isConnectionMenuSideDisabled(context("left", snapshot))).toBe(true)
	})

	it.each([
		ElementTypeEnum.Rectangle,
		ElementTypeEnum.Ellipse,
		ElementTypeEnum.Triangle,
		ElementTypeEnum.Star,
	])("disables every default menu item for %s sources", (type) => {
		const snapshot = createSnapshot([type])
		expect(getAllowedConnectionMenuCreateKinds(context("left", snapshot))).toEqual([])
		expect(getAllowedConnectionMenuCreateKinds(context("right", snapshot))).toEqual([])
		expect(isConnectionMenuSideDisabled(context("left", snapshot))).toBe(true)
		expect(isConnectionMenuSideDisabled(context("right", snapshot))).toBe(true)
	})

	it("allows only image generation on the left side of storyboard elements", () => {
		const snapshot = createSnapshot([ElementTypeEnum.Storyboard])
		expect(getAllowedConnectionMenuCreateKinds(context("left", snapshot))).toEqual([
			"image-generator",
		])
		expect(getAllowedConnectionMenuCreateKinds(context("right", snapshot))).toEqual([])
		expect(isConnectionMenuSideDisabled(context("left", snapshot))).toBe(false)
		expect(isConnectionMenuSideDisabled(context("right", snapshot))).toBe(true)
	})

	it("hides every right-side menu item for video merge elements", () => {
		const snapshot = createSnapshot([ElementTypeEnum.VideoEdit])
		expect(getAllowedConnectionMenuCreateKinds(context("right", snapshot))).toEqual([])
		expect(isConnectionMenuSideDisabled(context("right", snapshot))).toBe(true)
	})

	it("does not block the left-side menu for video merge elements", () => {
		const snapshot = createSnapshot([ElementTypeEnum.VideoEdit])
		expect(getAllowedConnectionMenuCreateKinds(context("left", snapshot))).toEqual([
			"video-generator",
		])
		expect(isConnectionMenuSideDisabled(context("left", snapshot))).toBe(false)
	})
})
