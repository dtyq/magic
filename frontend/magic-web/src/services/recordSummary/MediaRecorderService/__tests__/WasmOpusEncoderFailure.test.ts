import { describe, expect, it, vi } from "vitest"

const wasmState = vi.hoisted(() => ({
	free: vi.fn(),
}))

vi.mock("libopus-wasm", () => ({
	Application: { Audio: 2049 },
	createEncoder: vi.fn(async () => ({
		getLookahead: () => 104,
		encode: () => {
			throw new Error("Synthetic smoke encode failure")
		},
		free: wasmState.free,
	})),
}))

import { WasmOpusEncoder } from "../encoders/WasmOpusEncoder"

describe("WasmOpusEncoder initialization cleanup", () => {
	it("frees the local WASM encoder when smoke encoding fails", async () => {
		const encoder = new WasmOpusEncoder()

		await expect(encoder.initialize()).rejects.toThrow("Failed to initialize WASM Opus encoder")
		expect(wasmState.free).toHaveBeenCalledTimes(1)
	})
})
