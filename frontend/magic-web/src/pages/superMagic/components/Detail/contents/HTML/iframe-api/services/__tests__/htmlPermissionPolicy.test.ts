import { describe, expect, it } from "vitest"
import type { HtmlPermissionScope } from "../../types"
import {
	getDefaultHtmlPermissionTtl,
	getSharedHtmlPermissionTtlOptions,
	parseHtmlPermissionTtl,
	serializeHtmlPermissionTtl,
} from "../htmlPermissionPolicy"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe("htmlPermissionPolicy", () => {
	it.each<{
		scope: HtmlPermissionScope
		options: Array<number | null>
		defaultTtl: number | null
	}>([
		{ scope: "llm.use", options: [HOUR, 8 * HOUR, DAY, 7 * DAY, 30 * DAY], defaultTtl: DAY },
		{
			scope: "project.message.write",
			options: [0, HOUR, 8 * HOUR, DAY, 7 * DAY],
			defaultTtl: HOUR,
		},
		{
			scope: "project.files.upload",
			options: [HOUR, 8 * HOUR, DAY, 7 * DAY, 30 * DAY],
			defaultTtl: DAY,
		},
		{
			scope: "project.files.download",
			options: [HOUR, DAY, 7 * DAY, 30 * DAY],
			defaultTtl: 7 * DAY,
		},
		{
			scope: "fs.project.read",
			options: [HOUR, DAY, 7 * DAY, 30 * DAY],
			defaultTtl: 7 * DAY,
		},
		{
			scope: "fs.project.write",
			options: [0, HOUR, 8 * HOUR, DAY, 7 * DAY],
			defaultTtl: HOUR,
		},
		{
			scope: "user.profile.name",
			options: [DAY, 7 * DAY, 30 * DAY, null],
			defaultTtl: 7 * DAY,
		},
		{
			scope: "user.profile.identity",
			options: [HOUR, DAY, 7 * DAY, 30 * DAY],
			defaultTtl: 7 * DAY,
		},
		{
			scope: "user.profile.organization",
			options: [DAY, 7 * DAY, 30 * DAY, null],
			defaultTtl: 7 * DAY,
		},
	])("defines manifest durations for $scope", ({ scope, options, defaultTtl }) => {
		const ttlOptions = getSharedHtmlPermissionTtlOptions([scope], "manifest")
		expect(ttlOptions.map((option) => option.ttlMs)).toEqual(options)
		expect(getDefaultHtmlPermissionTtl([scope], "manifest", ttlOptions)).toBe(defaultTtl)
	})

	it.each<{
		scope: HtmlPermissionScope
		options: Array<number | null>
		defaultTtl: number
	}>([
		{ scope: "llm.use", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{ scope: "project.message.write", options: [0, HOUR, 8 * HOUR, null], defaultTtl: 0 },
		{ scope: "project.files.upload", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{ scope: "project.files.download", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{ scope: "fs.project.read", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{ scope: "fs.project.write", options: [0, HOUR, 8 * HOUR, null], defaultTtl: 0 },
		{ scope: "user.profile.name", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{ scope: "user.profile.identity", options: [HOUR, 8 * HOUR, DAY, null], defaultTtl: HOUR },
		{
			scope: "user.profile.organization",
			options: [HOUR, 8 * HOUR, DAY, null],
			defaultTtl: HOUR,
		},
	])(
		"defines legacy durations including permanent access for $scope",
		({ scope, options, defaultTtl }) => {
			const ttlOptions = getSharedHtmlPermissionTtlOptions([scope], "legacy")
			expect(ttlOptions.map((option) => option.ttlMs)).toEqual(options)
			expect(getDefaultHtmlPermissionTtl([scope], "legacy", ttlOptions)).toBe(defaultTtl)
		},
	)

	it("calculates multi-scope options and defaults independently of scope order", () => {
		const firstOrder = ["fs.project.read", "project.message.write"] as HtmlPermissionScope[]
		const secondOrder = [...firstOrder].reverse()
		const firstOptions = getSharedHtmlPermissionTtlOptions(firstOrder, "manifest")
		const secondOptions = getSharedHtmlPermissionTtlOptions(secondOrder, "manifest")

		expect(firstOptions.map((option) => option.ttlMs)).toEqual([HOUR, DAY, 7 * DAY])
		expect(secondOptions).toEqual(firstOptions)
		expect(getDefaultHtmlPermissionTtl(firstOrder, "manifest", firstOptions)).toBe(HOUR)
		expect(getDefaultHtmlPermissionTtl(secondOrder, "manifest", secondOptions)).toBe(HOUR)
	})

	it("only shares always-allow when every scope supports it", () => {
		expect(
			getSharedHtmlPermissionTtlOptions(
				["user.profile.name", "user.profile.organization"],
				"manifest",
			).map((option) => option.ttlMs),
		).toContain(null)
		expect(
			getSharedHtmlPermissionTtlOptions(
				["user.profile.name", "user.profile.identity"],
				"manifest",
			).map((option) => option.ttlMs),
		).not.toContain(null)
	})

	it("serializes always-allow without conflating it with one-time access", () => {
		expect(serializeHtmlPermissionTtl(null)).toBe("always")
		expect(parseHtmlPermissionTtl("always")).toBeNull()
		expect(serializeHtmlPermissionTtl(0)).toBe("0")
		expect(parseHtmlPermissionTtl("0")).toBe(0)
	})
})
