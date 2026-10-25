import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import { useMicroAppCollaboratorManagement } from "../useMicroAppCollaboratorManagement"

const app: MicroAppListItem = {
	app_id: "app-1",
	project_id: "project-1",
	app_name: "应用",
	app_description: "",
	creator_id: "creator-1",
	cover_url: "",
	publish_status: "unpublished",
	updated_at: null,
	user_role: "manage",
}

describe("useMicroAppCollaboratorManagement", () => {
	it("keeps collaborator management disabled in the public edition", () => {
		const { result } = renderHook(() => useMicroAppCollaboratorManagement())

		expect(result.current.canManageCollaborators).toBe(false)
		expect(result.current.loadingAppId).toBeNull()
		expect(result.current.CollaboratorUpdatePanel).toBeNull()
		expect(result.current.openCollaboratorManager(app)).toBeUndefined()
	})
})
