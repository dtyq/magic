import Konva from "konva"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { ConnectionHandleRenderer } from "../ConnectionHandleRenderer"

const TEST_RECT = { x: 10, y: 20, width: 120, height: 80 }

beforeAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
		configurable: true,
		value: vi.fn(() => ({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: [0, 0, 0, 0] })),
		})),
	})
})

function getHandle(group: Konva.Group, side: "left" | "right"): Konva.Group {
	const handle = group
		.find(`.${ConnectionHandleRenderer.HANDLE_GROUP_NAME}`)
		.find((node) => node.getAttr("connectionHandleSide") === side)
	if (!(handle instanceof Konva.Group)) {
		throw new Error(`Expected ${side} handle to be a group`)
	}
	return handle
}

function getCorridor(group: Konva.Group, side: "left" | "right"): Konva.Rect {
	const corridor = group
		.find(`.${ConnectionHandleRenderer.HANDLE_CORRIDOR_NAME}`)
		.find((node) => node.getAttr("connectionHandleSide") === side)
	if (!(corridor instanceof Konva.Rect)) {
		throw new Error(`Expected ${side} corridor to be a rect`)
	}
	return corridor
}

function getCircle(handle: Konva.Group): Konva.Circle {
	const circle = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_CIRCLE_NAME}`)
	if (!(circle instanceof Konva.Circle)) {
		throw new Error("Expected handle circle")
	}
	return circle
}

function getHorizontalPlus(handle: Konva.Group): Konva.Line {
	const horizontal = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_PLUS_HORIZONTAL_NAME}`)
	if (!(horizontal instanceof Konva.Line)) {
		throw new Error("Expected horizontal plus line")
	}
	return horizontal
}

function getVerticalPlus(handle: Konva.Group): Konva.Line {
	const vertical = handle.findOne(`.${ConnectionHandleRenderer.HANDLE_PLUS_VERTICAL_NAME}`)
	if (!(vertical instanceof Konva.Line)) {
		throw new Error("Expected vertical plus line")
	}
	return vertical
}

function readScreenSpaceMetrics(group: Konva.Group, scale: number) {
	const leftHandle = getHandle(group, "left")
	const rightHandle = getHandle(group, "right")
	const leftCorridor = getCorridor(group, "left")
	const rightCorridor = getCorridor(group, "right")
	const leftCircle = getCircle(leftHandle)
	const horizontal = getHorizontalPlus(leftHandle)
	const points = horizontal.getAttr("points") as number[]

	return {
		leftOffset: (TEST_RECT.x - leftHandle.x()) * scale,
		rightOffset: (rightHandle.x() - TEST_RECT.x - TEST_RECT.width) * scale,
		leftCorridorWidth: leftCorridor.width() * scale,
		rightCorridorWidth: rightCorridor.width() * scale,
		radius: leftCircle.radius() * scale,
		strokeWidth: leftCircle.strokeWidth() * scale,
		plusWidth: (points[2] - points[0]) * scale,
	}
}

function expectMetricsToMatch(
	actual: ReturnType<typeof readScreenSpaceMetrics>,
	expected: ReturnType<typeof readScreenSpaceMetrics>,
): void {
	Object.entries(expected).forEach(([key, value]) => {
		expect(actual[key as keyof typeof actual]).toBeCloseTo(value, 6)
	})
}

describe("ConnectionHandleRenderer", () => {
	it("renders left and right interactive handles with runtime attrs", () => {
		const renderer = new ConnectionHandleRenderer()
		const origin = { kind: "element" as const, elementId: "element-1" }
		const group = renderer.createOverlay(origin, TEST_RECT, 1)

		expect(group.name()).toBe(ConnectionHandleRenderer.OVERLAY_GROUP_NAME)
		const leftHandle = getHandle(group, "left")
		const rightHandle = getHandle(group, "right")
		const leftCorridor = getCorridor(group, "left")
		const rightCorridor = getCorridor(group, "right")

		expect(leftHandle.id()).toBe("element-1")
		expect(rightHandle.id()).toBe("element-1")
		expect(leftHandle.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)).toEqual(origin)
		expect(rightHandle.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)).toEqual(origin)
		expect(leftCorridor.id()).toBe("element-1")
		expect(rightCorridor.id()).toBe("element-1")
		expect(leftCorridor.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)).toEqual(origin)
		expect(leftCorridor.getAttr("connectionHandleSide")).toBe("left")
		expect(rightCorridor.getAttr("connectionHandleSide")).toBe("right")
		expect(leftCorridor.y()).toBe(TEST_RECT.y)
		expect(leftCorridor.height()).toBe(TEST_RECT.height)
		expect(leftCorridor.x() + leftCorridor.width()).toBeCloseTo(TEST_RECT.x)
		expect(rightCorridor.x()).toBe(TEST_RECT.x + TEST_RECT.width)
		expect(rightCorridor.y()).toBe(TEST_RECT.y)
		expect(rightCorridor.height()).toBe(TEST_RECT.height)
		expect(leftCorridor.width()).toBeGreaterThan(0)
		expect(rightCorridor.width()).toBeGreaterThan(0)
		expect(leftCorridor.listening()).toBe(true)
		expect(leftHandle.y()).toBe(TEST_RECT.y + TEST_RECT.height / 2)
		expect(rightHandle.y()).toBe(TEST_RECT.y + TEST_RECT.height / 2)
		expect(leftHandle.x()).toBeLessThan(TEST_RECT.x)
		expect(rightHandle.x()).toBeGreaterThan(TEST_RECT.x + TEST_RECT.width)
		expect(TEST_RECT.x - leftHandle.x()).toBeCloseTo(
			rightHandle.x() - TEST_RECT.x - TEST_RECT.width,
		)
		expect(leftHandle.listening()).toBe(true)

		const leftCircle = getCircle(leftHandle)
		expect(leftCircle.radius()).toBeGreaterThan(0)
		expect(leftCircle.fill()).toBeTruthy()
		expect(leftCircle.stroke()).toBeTruthy()
		expect(leftCircle.strokeWidth()).toBeGreaterThan(0)
		expect(leftCircle.listening()).toBe(true)
	})

	it("keeps the real selection roots and revision on multi-selection handles", () => {
		const renderer = new ConnectionHandleRenderer()
		const group = renderer.createOverlay(
			{
				kind: "selection",
				elementIds: ["frame-1", "video-2"],
				selectionRevision: "frame-1\u0000video-2",
			},
			TEST_RECT,
			1,
		)

		const rightHandle = getHandle(group, "right")
		const leftCorridor = getCorridor(group, "left")
		expect(rightHandle.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)).toEqual({
			kind: "selection",
			elementIds: ["frame-1", "video-2"],
			selectionRevision: "frame-1\u0000video-2",
		})
		expect(leftCorridor.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)).toEqual({
			kind: "selection",
			elementIds: ["frame-1", "video-2"],
			selectionRevision: "frame-1\u0000video-2",
		})
		expect(leftCorridor.id()).toBe("frame-1")
	})

	it("keeps handle distance and visual metrics stable when viewport scales", () => {
		const renderer = new ConnectionHandleRenderer()
		const origin = { kind: "element" as const, elementId: "element-1" }
		const group = renderer.createOverlay(origin, TEST_RECT, 1)

		const baselineMetrics = readScreenSpaceMetrics(group, 1)
		expect(baselineMetrics.leftOffset).toBeGreaterThan(0)
		expect(baselineMetrics.leftOffset).toBeCloseTo(baselineMetrics.rightOffset)
		expect(baselineMetrics.leftCorridorWidth).toBeGreaterThan(baselineMetrics.leftOffset)
		expect(baselineMetrics.rightCorridorWidth).toBeCloseTo(baselineMetrics.leftCorridorWidth)
		expect(baselineMetrics.radius).toBeGreaterThan(0)
		expect(baselineMetrics.strokeWidth).toBeGreaterThan(0)
		expect(baselineMetrics.plusWidth).toBeGreaterThan(0)
		expect(baselineMetrics.plusWidth).toBeLessThan(baselineMetrics.radius * 2)

		renderer.updateOverlay(group, origin, TEST_RECT, 2)

		expectMetricsToMatch(readScreenSpaceMetrics(group, 2), baselineMetrics)

		renderer.updateOverlay(group, origin, TEST_RECT, 0.5)

		expectMetricsToMatch(readScreenSpaceMetrics(group, 0.5), baselineMetrics)
	})

	it("uses the same screen-space metrics for geometry hit regions", () => {
		const renderer = new ConnectionHandleRenderer()
		const group = renderer.createOverlay(
			{ kind: "element", elementId: "element-1" },
			TEST_RECT,
			1,
		)
		const leftCorridor = getCorridor(group, "left")
		const rightCorridor = getCorridor(group, "right")
		const leftRegion = renderer
			.getHandleHitRegions(TEST_RECT, 1)
			.find((region) => region.side === "left")
		const rightRegion = renderer
			.getHandleHitRegions(TEST_RECT, 1)
			.find((region) => region.side === "right")

		expect(leftRegion).toMatchObject({
			x: leftCorridor.x(),
			y: leftCorridor.y(),
			width: leftCorridor.width(),
			height: leftCorridor.height(),
			side: "left",
		})
		expect(rightRegion).toMatchObject({
			x: rightCorridor.x(),
			y: rightCorridor.y(),
			width: rightCorridor.width(),
			height: rightCorridor.height(),
			side: "right",
		})
		expect(
			renderer.isPointInHandleHitRegion(TEST_RECT, 1, {
				x: TEST_RECT.x + TEST_RECT.width + 10,
				y: TEST_RECT.y + TEST_RECT.height / 2,
			}),
		).toBe(true)
		expect(
			renderer.isPointInHandleHitRegion(TEST_RECT, 1, {
				x: TEST_RECT.x + TEST_RECT.width + 80,
				y: TEST_RECT.y + TEST_RECT.height / 2,
			}),
		).toBe(false)
	})

	it("keeps a continuous horizontal path from the element bounds into each handle corridor", () => {
		const renderer = new ConnectionHandleRenderer()

		expect(
			renderer.isPointInHandleKeepAliveRegion(TEST_RECT, 1, {
				x: TEST_RECT.x + TEST_RECT.width / 2,
				y: TEST_RECT.y + TEST_RECT.height / 2,
			}),
		).toBe(true)
		expect(
			renderer.isPointInHandleKeepAliveRegion(TEST_RECT, 1, {
				x: TEST_RECT.x - 10,
				y: TEST_RECT.y + TEST_RECT.height / 2,
			}),
		).toBe(true)
		expect(
			renderer.isPointInHandleKeepAliveRegion(TEST_RECT, 1, {
				x: TEST_RECT.x + TEST_RECT.width + 10,
				y: TEST_RECT.y + TEST_RECT.height / 2,
			}),
		).toBe(true)
		expect(
			renderer.isPointInHandleKeepAliveRegion(TEST_RECT, 1, {
				x: TEST_RECT.x + TEST_RECT.width / 2,
				y: TEST_RECT.y - 1,
			}),
		).toBe(false)
	})

	it("applies hover and active styles without changing handle geometry", () => {
		const renderer = new ConnectionHandleRenderer()
		const group = renderer.createOverlay(
			{ kind: "element", elementId: "element-1" },
			TEST_RECT,
			1,
		)
		const leftHandle = getHandle(group, "left")
		const circle = getCircle(leftHandle)
		const horizontal = getHorizontalPlus(leftHandle)
		const vertical = getVerticalPlus(leftHandle)
		const baseGeometry = {
			position: leftHandle.position(),
			radius: circle.radius(),
			strokeWidth: circle.strokeWidth(),
			horizontalPoints: horizontal.points(),
			verticalPoints: vertical.points(),
		}
		const baseStyle = {
			fill: circle.fill(),
			stroke: circle.stroke(),
			plusStroke: horizontal.stroke(),
			shadowOpacity: circle.shadowOpacity(),
		}

		renderer.setHandleInteractionState(leftHandle, "hover")

		expect(leftHandle.getAttr("connectionHandleInteractionState")).toBe("hover")
		expect(circle.fill()).not.toBe(baseStyle.fill)
		expect(circle.stroke()).not.toBe(baseStyle.stroke)
		expect(horizontal.stroke()).toBe(circle.stroke())
		expect(vertical.stroke()).toBe(circle.stroke())
		expect(circle.shadowOpacity()).toBeGreaterThan(baseStyle.shadowOpacity)
		expect(leftHandle.position()).toEqual(baseGeometry.position)
		expect(circle.radius()).toBe(baseGeometry.radius)
		expect(circle.strokeWidth()).toBe(baseGeometry.strokeWidth)
		expect(horizontal.points()).toEqual(baseGeometry.horizontalPoints)
		expect(vertical.points()).toEqual(baseGeometry.verticalPoints)

		const hoverFill = circle.fill()
		const hoverShadowOpacity = circle.shadowOpacity()
		renderer.setHandleInteractionState(leftHandle, "active")

		expect(leftHandle.getAttr("connectionHandleInteractionState")).toBe("active")
		expect(circle.fill()).not.toBe(hoverFill)
		expect(circle.shadowOpacity()).toBeGreaterThanOrEqual(hoverShadowOpacity)
		expect(leftHandle.position()).toEqual(baseGeometry.position)
		expect(circle.radius()).toBe(baseGeometry.radius)
		expect(horizontal.points()).toEqual(baseGeometry.horizontalPoints)

		renderer.setHandleInteractionState(leftHandle, "idle")

		expect(leftHandle.getAttr("connectionHandleInteractionState")).toBe("idle")
		expect(circle.fill()).toBe(baseStyle.fill)
		expect(circle.stroke()).toBe(baseStyle.stroke)
		expect(horizontal.stroke()).toBe(baseStyle.plusStroke)
		expect(vertical.stroke()).toBe(baseStyle.plusStroke)
		expect(circle.shadowOpacity()).toBe(0)
	})

	it("applies a non-interactive disabled style to configured handle sides", () => {
		const renderer = new ConnectionHandleRenderer()
		const group = renderer.createOverlay(
			{ kind: "element", elementId: "video-edit-1" },
			TEST_RECT,
			1,
			["right"],
		)
		const leftHandle = getHandle(group, "left")
		const rightHandle = getHandle(group, "right")
		const leftCircle = getCircle(leftHandle)
		const rightCircle = getCircle(rightHandle)

		expect(leftHandle.getAttr(ConnectionHandleRenderer.HANDLE_DISABLED_ATTR)).toBe(false)
		expect(leftHandle.listening()).toBe(true)
		expect(leftCircle.opacity()).toBe(1)
		expect(rightHandle.getAttr(ConnectionHandleRenderer.HANDLE_DISABLED_ATTR)).toBe(true)
		expect(rightHandle.getAttr("connectionHandleInteractionState")).toBe("disabled")
		expect(rightHandle.listening()).toBe(false)
		expect(rightCircle.opacity()).toBeLessThan(leftCircle.opacity())
		expect(getHorizontalPlus(rightHandle).opacity()).toBeLessThan(1)
		expect(getVerticalPlus(rightHandle).opacity()).toBeLessThan(1)
	})
})
