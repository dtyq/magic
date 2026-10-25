import { afterEach, describe, expect, it, vi } from "vitest"
import { preflightPptxExport } from "../src/api/preflight"
import type { PptxDestination } from "../src/api/options"

function createSinkProxyDestination(): PptxDestination {
	return {
		kind: "sink-proxy",
		replayPolicy: "buffered",
		sink: {
			write: vi.fn(),
			close: vi.fn(),
			abort: vi.fn(),
		},
	}
}

describe("preflightPptxExport", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("rejects a large export without a destination", () => {
		const result = preflightPptxExport({ hasInjectedPackager: true })

		expect(result.accepted).toBe(false)
		expect(result.errors.map((issue) => issue.code)).toContain("destination-required")
	})

	it("accepts a sink-proxy destination", () => {
		const result = preflightPptxExport({
			destination: createSinkProxyDestination(),
			pageCount: 300,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(true)
		expect(result.outputPolicy).toBe("file-stream")
		expect(result.errors).toEqual([])
	})

	it("accepts a raw Node writable destination", () => {
		const destination = {
			write: vi.fn(),
			end: vi.fn(),
			on: vi.fn(),
			destroy: vi.fn(),
		} as unknown as NodeJS.WritableStream

		const result = preflightPptxExport({
			destination,
			pageCount: 300,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(true)
		expect(result.errors).toEqual([])
	})

	it("rejects a raw Node writable that cannot destroy a partial output", () => {
		const destination = {
			write: vi.fn(),
			end: vi.fn(),
			on: vi.fn(),
		} as unknown as NodeJS.WritableStream

		const result = preflightPptxExport({
			destination,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(false)
		expect(result.errors.map((issue) => issue.code)).toContain("destination-abort-required")
	})

	it("rejects a sink that cannot discard a partial output", () => {
		const result = preflightPptxExport({
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn() },
			},
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(false)
		expect(result.errors.map((issue) => issue.code)).toContain("destination-abort-required")
	})

	it("rejects malformed wrapped destinations before starting the export", () => {
		const malformedSink = preflightPptxExport({
			destination: {
				kind: "sink-proxy",
				sink: { abort: vi.fn() },
			} as unknown as PptxDestination,
			hasInjectedPackager: true,
		})
		const malformedNodeWritable = preflightPptxExport({
			destination: {
				kind: "node-writable",
				writable: { destroy: vi.fn() },
			} as unknown as PptxDestination,
			hasInjectedPackager: true,
		})

		expect(malformedSink.errors.map((issue) => issue.code)).toContain("invalid-destination")
		expect(malformedNodeWritable.errors.map((issue) => issue.code)).toContain(
			"invalid-destination",
		)
	})

	it("rejects when OPFS staging is required but unavailable", () => {
		vi.stubGlobal("navigator", {})

		const result = preflightPptxExport({
			destination: createSinkProxyDestination(),
			requiresOpfs: true,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(false)
		expect(result.requiresOpfs).toBe(true)
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "opfs-unavailable",
					details: {
						capability: "opfs-staging",
						detection: "navigator.storage.getDirectory",
					},
				}),
			]),
		)
	})

	it("allows a buffered sink to use the in-memory replay fallback", () => {
		vi.stubGlobal("navigator", {})

		const result = preflightPptxExport({
			destination: createSinkProxyDestination(),
			requiresOpfs: true,
			hasInjectedPackager: true,
			hasInMemoryStagingStore: true,
		})

		expect(result.accepted).toBe(true)
		expect(result.requiresOpfs).toBe(true)
		expect(result.errors).toEqual([])
	})

	it("keeps an explicitly file-stream sink on the OPFS requirement", () => {
		vi.stubGlobal("navigator", {})

		const result = preflightPptxExport({
			destination: {
				kind: "sink-proxy",
				replayPolicy: "opfs-required",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			requiresOpfs: true,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(false)
		expect(result.errors.map((issue) => issue.code)).toContain("opfs-unavailable")
	})

	it("classifies storage access failures as unavailable OPFS", () => {
		vi.stubGlobal("navigator", {
			get storage(): never {
				throw new DOMException("Storage access denied", "SecurityError")
			},
		})

		const result = preflightPptxExport({
			destination: createSinkProxyDestination(),
			requiresOpfs: true,
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(false)
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "opfs-unavailable",
					details: expect.objectContaining({ capability: "opfs-staging" }),
				}),
			]),
		)
	})

	it("keeps an unknown cumulative size in classic ZIP for PowerPoint compatibility", () => {
		const result = preflightPptxExport({
			destination: createSinkProxyDestination(),
			hasInjectedPackager: true,
		})

		expect(result.accepted).toBe(true)
		expect(result.zipMode).toBe("classic")
		expect(result.capacityConfidence).toBe("streaming-unknown")
		expect(result.estimatedOutputBytes).toBeUndefined()
		expect(result.warnings.map((issue) => issue.code)).toContain("unknown-output-size")
	})
})
