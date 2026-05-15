import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import useCollaboratorUpdatePanel from "../useCollaboratorUpdatePanel"

describe("useCollaboratorUpdatePanel", () => {
	it("在默认实现下标记协作者管理能力不可用", () => {
		const { result } = renderHook(() =>
			useCollaboratorUpdatePanel({
				selectedProject: null,
			}),
		)

		expect(result.current.canManageCollaborators).toBe(false)
		expect(result.current.CollaboratorUpdatePanel).toBeNull()
	})
})