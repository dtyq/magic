import { describe, expect, it } from "vitest"
import { collectMentionPathsToAdd } from "../useMentionSync"

describe("collectMentionPathsToAdd", () => {
	it("adds same-name paths that have distinct identities", () => {
		const currentPathByIdentity = new Map([["workspace:/画布A/images/a.png", "./images/a.png"]])
		const getResourceIdentity = (path?: string) =>
			path === "./images/a.png" || path === "/画布A/images/a.png"
				? "workspace:/画布A/images/a.png"
				: `workspace:${path}`

		expect(
			collectMentionPathsToAdd(
				["./images/a.png", "/other/a.png"],
				currentPathByIdentity,
				getResourceIdentity,
			),
		).toEqual(["/other/a.png"])
	})

	it("does not add another spelling of an already referenced identity", () => {
		const currentPathByIdentity = new Map([["workspace:/画布A/images/a.png", "./images/a.png"]])
		const getResourceIdentity = (path?: string) => "workspace:/画布A/images/a.png"

		expect(
			collectMentionPathsToAdd(
				["/画布A/images/a.png"],
				currentPathByIdentity,
				getResourceIdentity,
			),
		).toEqual([])
	})

	it("treats unresolved relative and absolute spellings as distinct identities", () => {
		const currentPathByIdentity = new Map([["unresolved:./images/a.png", "./images/a.png"]])
		const getResourceIdentity = (path?: string) => `unresolved:${path}`

		expect(
			collectMentionPathsToAdd(["/images/a.png"], currentPathByIdentity, getResourceIdentity),
		).toEqual(["/images/a.png"])
	})
})
