import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import useProjectTransferModal from "../useProjectTransferModal"

describe("useProjectTransferModal", () => {
	it("在默认实现下标记项目转让能力不可用", () => {
		const { result } = renderHook(() => useProjectTransferModal(null))

		expect(result.current.canTransferProject).toBe(false)
		expect(result.current.TransferModalComponent).toBeNull()
	})
})