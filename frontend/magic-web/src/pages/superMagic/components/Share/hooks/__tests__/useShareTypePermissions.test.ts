import { describe, expect, it } from "vitest"
import { ShareType } from "../../types"
import { getPermittedShareTypes, hasSharePermissionGroup } from "../useShareTypePermissions"

describe("getPermittedShareTypes", () => {
	it("maps project permissions to their share types", () => {
		expect(
			getPermittedShareTypes(
				{
					"project.share_password": true,
					"project.share_public": false,
					"project.share_team": true,
				},
				"project",
			),
		).toEqual([ShareType.PasswordProtected, ShareType.Organization])
	})

	it("does not mix micro app and project permissions", () => {
		expect(
			getPermittedShareTypes(
				{
					"micro_app.share_public": true,
					"project.share_password": true,
				},
				"microApp",
			),
		).toEqual([ShareType.Public])
	})

	it("maps topic permissions to their share types", () => {
		expect(
			getPermittedShareTypes(
				{
					"topic.share_public": true,
					"topic.share_password": false,
				},
				"topic",
			),
		).toEqual([ShareType.Public])
	})

	it("keeps topic permissions apart from the project group", () => {
		// The page group leaves both methods open, while the topic group only opened public access.
		expect(
			getPermittedShareTypes(
				{
					"project.share_public": true,
					"project.share_password": true,
					"topic.share_public": true,
					"topic.share_password": false,
				},
				"topic",
			),
		).toEqual([ShareType.Public])
	})

	it("never permits a team share for topics", () => {
		expect(
			getPermittedShareTypes(
				{
					"project.share_team": true,
					"topic.share_public": true,
				},
				"topic",
			),
		).toEqual([ShareType.Public])
	})

	it("fails closed while permissions are unavailable", () => {
		expect(getPermittedShareTypes(undefined, "project")).toEqual([])
	})
})

describe("hasSharePermissionGroup", () => {
	it("detects a group the response describes", () => {
		expect(hasSharePermissionGroup({ "topic.share_public": false }, "topic")).toBe(true)
	})

	it("reports a group the response does not describe yet", () => {
		expect(
			hasSharePermissionGroup(
				{ "project.share_public": true, "project.share_team": true },
				"topic",
			),
		).toBe(false)
		expect(hasSharePermissionGroup(undefined, "topic")).toBe(false)
	})
})
