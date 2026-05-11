import { describe, expect, it } from "vitest"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import { shouldShowCrewKnowledgeBaseEntry } from "../knowledge-entry-visibility"

describe("shouldShowCrewKnowledgeBaseEntry", () => {
	it("shows the entry only for the crew creator", () => {
		expect(shouldShowCrewKnowledgeBaseEntry(CollaboratorPermissionEnum.OWNER)).toBe(true)
		expect(shouldShowCrewKnowledgeBaseEntry(CollaboratorPermissionEnum.MANAGE)).toBe(false)
		expect(shouldShowCrewKnowledgeBaseEntry(CollaboratorPermissionEnum.EDITABLE)).toBe(false)
		expect(shouldShowCrewKnowledgeBaseEntry(CollaboratorPermissionEnum.READONLY)).toBe(false)
		expect(shouldShowCrewKnowledgeBaseEntry()).toBe(false)
	})
})
