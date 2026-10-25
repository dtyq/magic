import { describe, expect, it, vi } from "vitest"
import { ElementDetailsRuntimeManager } from "../ElementDetailsRuntimeManager"

describe("ElementDetailsRuntimeManager", () => {
	it("keeps legacy inline polling when the host did not provide provenance", () => {
		const manager = new ElementDetailsRuntimeManager()

		expect(manager.getGenerateImageRequestImageIdSource("image-1", "legacy-task")).toBe(
			"inline",
		)
		manager.replace({})
		expect(manager.getGenerateImageRequestImageIdSource("image-1", "unknown-task")).toBe(
			"unknown",
		)
	})

	it("binds provenance to the exact image id", () => {
		const manager = new ElementDetailsRuntimeManager()
		manager.replace({
			"image-1": {
				contentDetails: {
					"content-1": {
						generateImageRequest: {
							valueSource: "agent",
							imageId: "agent-file-1",
							imageIdSource: "agent",
						},
					},
				},
			},
		})

		expect(
			manager.getGenerateImageRequestImageIdSource("image-1", "agent-file-1", "content-1"),
		).toBe("agent")
		expect(manager.getGenerateImageRequestImageIdSource("image-1", "new-task")).toBe("unknown")
	})

	it("records a confirmed frontend task in runtime and notifies the host", () => {
		const onChange = vi.fn()
		const manager = new ElementDetailsRuntimeManager({ onChange })

		manager.markGenerateImageRequestAsUser("image-1", "user-task-1", "content-1")

		expect(
			manager.getGenerateImageRequestImageIdSource("image-1", "user-task-1", "content-1"),
		).toBe("user")
		expect(onChange).toHaveBeenCalledWith({
			"image-1": {
				contentDetails: {
					"content-1": {
						sidecarSource: "user",
						generateImageRequest: {
							valueSource: "user",
							imageId: "user-task-1",
							imageIdSource: "user",
						},
					},
				},
			},
		})
	})
})
