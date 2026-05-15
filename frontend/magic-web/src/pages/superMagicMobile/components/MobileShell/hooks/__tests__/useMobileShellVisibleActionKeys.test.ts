import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useMobileShellVisibleActionKeys } from "../useMobileShellVisibleActionKeys"

describe("useMobileShellVisibleActionKeys", () => {
	it("默认只返回精简项目动作", () => {
		const { result } = renderHook(() => useMobileShellVisibleActionKeys())

		expect(result.current).toEqual(["rename", "move", "delete"])
	})
})