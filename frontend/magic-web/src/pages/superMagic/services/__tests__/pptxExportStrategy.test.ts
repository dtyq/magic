import { afterEach, describe, expect, it } from "vitest"
import {
	PPTX_EXPORT_FLAGS_STORAGE_KEY,
	resolvePptxExportFeatureFlags,
	resolvePptxExportStrategy,
	resolvePptxMediaPolicyMode,
} from "../pptxExportStrategy"

afterEach(() => {
	localStorage.removeItem(PPTX_EXPORT_FLAGS_STORAGE_KEY)
	Reflect.deleteProperty(globalThis, "__MAGIC_PPTX_EXPORT_FLAGS__")
})

describe("PPTX export strategy", () => {
	it("uses direct-stream for stable sources and rolling-stage for signed URLs", () => {
		expect(resolvePptxMediaPolicyMode({ mediaSource: "stable-url" })).toBe("direct-stream")
		expect(resolvePptxMediaPolicyMode({ mediaSource: "signed-url" })).toBe("rolling-stage")
		expect(
			resolvePptxMediaPolicyMode({
				requested: "full-stage",
				mediaSource: "stable-url",
			}),
		).toBe("full-stage")
	})

	it("uses the client-side buffered route when file streaming is unavailable", () => {
		expect(
			resolvePptxExportStrategy({
				pageCount: 20,
				fileStreamingAvailable: false,
				bufferedDownloadAvailable: true,
			}),
		).toMatchObject({
			route: "legacy-blob",
			reasonCode: "legacy-blob",
			isLargeExport: false,
		})
	})

	it("returns unavailable when neither file streaming nor buffered download is available", () => {
		expect(
			resolvePptxExportStrategy({
				hasLargeMedia: true,
				fileStreamingAvailable: false,
				bufferedDownloadAvailable: false,
			}),
		).toMatchObject({
			route: "unavailable",
			reasonCode: "file-stream-unavailable",
			isLargeExport: true,
		})
	})

	it("blocks a ZIP64 candidate when the independent ZIP64 flag is disabled", () => {
		expect(
			resolvePptxExportStrategy({
				estimatedBytes: BigInt(5) * BigInt(1024) ** BigInt(3),
				fileStreamingAvailable: true,
				flags: { zip64: false },
			}),
		).toMatchObject({
			route: "unavailable",
			reasonCode: "zip64-disabled",
			requiresZip64: true,
		})
	})

	it("merges stored and runtime flags with explicit overrides taking precedence", () => {
		localStorage.setItem(
			PPTX_EXPORT_FLAGS_STORAGE_KEY,
			JSON.stringify({ streamingOutputSink: false, zip64: false }),
		)
		Object.defineProperty(globalThis, "__MAGIC_PPTX_EXPORT_FLAGS__", {
			configurable: true,
			value: { streamingOutputSink: true, zipJsPackageWriter: false },
		})

		expect(resolvePptxExportFeatureFlags({ zipJsPackageWriter: true })).toMatchObject({
			streamingOutputSink: true,
			zip64: false,
			zipJsPackageWriter: true,
		})
	})
})
