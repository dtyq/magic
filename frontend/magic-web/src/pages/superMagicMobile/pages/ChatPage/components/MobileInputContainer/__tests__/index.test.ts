import { describe, expect, it, vi } from "vitest"
import { clearMobileSceneSelectionOnSendSuccess } from "../sceneSelection"

describe("clearMobileSceneSelectionOnSendSuccess", () => {
	it("clears the current scene before the next mobile chat can select again", () => {
		const setCurrentScene = vi.fn()

		clearMobileSceneSelectionOnSendSuccess({ setCurrentScene })

		expect(setCurrentScene).toHaveBeenCalledOnce()
		expect(setCurrentScene).toHaveBeenCalledWith(null)
	})
})
