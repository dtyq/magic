import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Konva from "konva"
import { complianceNameLabelIconResolver } from "../complianceNameLabelIconResolver"

function resolve(options: {
	status?: "UNVERIFIED" | "PROCESSING" | "PASS" | "FAILED"
	isAssetLibrary?: boolean
	failedReason?: string
}) {
	return complianceNameLabelIconResolver({
		elementId: "image-1",
		element: { canvas: { isSeedanceComplianceEnabled: () => true } } as never,
		data: {} as never,
		selected: false,
		hovered: false,
		isAssetLibrary: options.isAssetLibrary ?? false,
		complianceStatus: options.status,
		complianceFailedReason: options.failedReason,
	})
}

describe("complianceNameLabelIconResolver", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("prioritizes compliance over the asset-library icon", () => {
		expect(resolve({ status: "PROCESSING", isAssetLibrary: true })).toMatchObject({
			key: "compliance-processing",
		})
		expect(resolve({ status: "PASS", isAssetLibrary: true })).toMatchObject({
			key: "compliance-pass",
		})
	})

	it("uses a failure shield for failed assets before the asset-library fallback", () => {
		expect(resolve({ status: "UNVERIFIED", isAssetLibrary: true })).toMatchObject({
			key: "asset-library",
		})
		expect(
			resolve({ status: "FAILED", isAssetLibrary: true, failedReason: "blocked" }),
		).toMatchObject({
			key: "compliance-failed",
		})
	})

	it("does not show an icon for unverified media", () => {
		expect(resolve({ status: "UNVERIFIED" })).toBeNull()
		expect(resolve({ status: "FAILED", failedReason: "blocked" })).toMatchObject({
			key: "compliance-failed",
		})
	})

	it("creates non-hit-tested Konva icon nodes", () => {
		const descriptor = resolve({ status: "PASS" })
		const node = descriptor?.create({} as never)
		expect(node).toBeInstanceOf(Konva.Group)
		expect(node?.listening()).toBe(false)
		expect(descriptor).toMatchObject({ width: 16, height: 16 })
		const path = node?.findOne("Path") as Konva.Path | null
		expect(path?.x()).toBe(0)
		expect(path?.scaleX()).toBeCloseTo(2 / 3)
	})
})
