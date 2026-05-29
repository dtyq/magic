import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
	MOBILE_PROJECT_ACTION_ORDER,
	SHELL_RECENT_CHAT_ACTION_KEYS,
	useMobileShellVisibleActionKeys,
} from "../useMobileShellVisibleActionKeys"

describe("useMobileShellVisibleActionKeys", () => {
	it("returns prototype project whitelist for sidebar recent rows", () => {
		const { result } = renderHook(() => useMobileShellVisibleActionKeys())

		expect(result.current).toEqual(MOBILE_PROJECT_ACTION_ORDER)
	})

	it("exports chat whitelist without pin", () => {
		expect(SHELL_RECENT_CHAT_ACTION_KEYS).toEqual(["rename", "saveAsProject", "delete"])
	})
})
