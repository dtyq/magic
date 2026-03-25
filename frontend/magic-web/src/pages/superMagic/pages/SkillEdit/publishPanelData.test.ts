import { describe, expect, it } from "vitest"
import {
	buildPublishParamsFromDraft,
	createSkillEditPublishPanelData,
	createSkillEditPublishPrefillDraft,
} from "./publishPanelData"

describe("buildPublishParamsFromDraft", () => {
	it("maps the private target to the publish api payload", () => {
		expect(
			buildPublishParamsFromDraft({
				version: "v1.0.0",
				details: " First release ",
				publishTo: "INTERNAL",
				internalTarget: "PRIVATE",
				specificMembers: [],
			}),
		).toEqual({
			version: "1.0.0",
			version_description_i18n: {
				zh_CN: "First release",
				en_US: "First release",
			},
			publish_target_type: "PRIVATE",
			publish_target_value: null,
		})
	})

	it("maps skills library publishing to market", () => {
		expect(
			buildPublishParamsFromDraft({
				version: "2.0.0",
				details: "Library release",
				publishTo: "MARKET",
				internalTarget: "MEMBER",
				specificMembers: [
					{
						id: "user-1",
						name: "Alice",
						type: "user",
					},
				],
			}),
		).toEqual({
			version: "2.0.0",
			version_description_i18n: {
				zh_CN: "Library release",
				en_US: "Library release",
			},
			publish_target_type: "MARKET",
			publish_target_value: null,
		})
	})

	it("drops hidden specific members for private publishing", () => {
		expect(
			buildPublishParamsFromDraft({
				version: "2.1.0",
				details: "Private release",
				publishTo: "INTERNAL",
				internalTarget: "PRIVATE",
				specificMembers: [
					{
						id: "dept-1",
						name: "Marketing",
						type: "department",
					},
				],
			}),
		).toEqual({
			version: "2.1.0",
			version_description_i18n: {
				zh_CN: "Private release",
				en_US: "Private release",
			},
			publish_target_type: "PRIVATE",
			publish_target_value: null,
		})
	})

	it("maps specific member publishing to member target", () => {
		expect(
			buildPublishParamsFromDraft({
				version: "3.0.0",
				details: "Internal beta",
				publishTo: "INTERNAL",
				internalTarget: "MEMBER",
				specificMembers: [
					{
						id: "dept-1",
						name: "Marketing",
						type: "department",
					},
				],
			}),
		).toEqual({
			version: "3.0.0",
			version_description_i18n: {
				zh_CN: "Internal beta",
				en_US: "Internal beta",
			},
			publish_target_type: "MEMBER",
			publish_target_value: {
				department_ids: ["dept-1"],
			},
		})
	})

	it("uses detail publish availability for market-only skills", () => {
		const data = createSkillEditPublishPanelData({
			skill: {
				id: "skill-1",
				code: "skill_1",
				name: "Skill 1",
				nameI18n: {
					default: "Skill 1",
					zh_CN: "Skill 1",
					en_US: "Skill 1",
				},
				description: "Skill 1 description",
				publishStatus: "published",
				publishType: "MARKET",
				allowedPublishTargetTypes: [],
			},
			versions: [],
			currentPublisherName: "Alice",
			t: ((key: string) => key) as never,
		})

		expect(data.availablePublishTo).toEqual(["MARKET"])
		expect(data.availableInternalTargets).toEqual([])
		expect(data.draft.publishTo).toBe("MARKET")
	})

	it("uses detail publish availability for internal skill targets", () => {
		const data = createSkillEditPublishPanelData({
			skill: {
				id: "skill-1",
				code: "skill_1",
				name: "Skill 1",
				nameI18n: {
					default: "Skill 1",
					zh_CN: "Skill 1",
					en_US: "Skill 1",
				},
				description: "Skill 1 description",
				publishStatus: "published",
				publishType: "INTERNAL",
				allowedPublishTargetTypes: ["PRIVATE", "MEMBER"],
			},
			versions: [],
			currentPublisherName: "Alice",
			t: ((key: string) => key) as never,
		})

		expect(data.availablePublishTo).toEqual(["INTERNAL"])
		expect(data.availableInternalTargets).toEqual(["PRIVATE", "MEMBER"])
		expect(data.draft.publishTo).toBe("INTERNAL")
		expect(data.draft.internalTarget).toBe("PRIVATE")
	})

	it("maps member publish targets into version detail members", () => {
		const data = createSkillEditPublishPanelData({
			skill: null,
			versions: [
				{
					id: "version-1",
					version: "1.0.0",
					publish_status: "PUBLISHED",
					review_status: "APPROVED",
					publish_target_type: "MEMBER",
					publish_target_value: {
						users: [{ id: "user-1", name: "Alice" }],
						departments: [{ id: "dept-1", name: "Design" }],
					},
					publisher: null,
					published_at: "2026-03-22 10:00:00",
					is_current_version: true,
					version_description_i18n: null,
				},
			],
			currentPublisherName: "Alice",
			t: ((key: string) => key) as never,
		})

		expect(data.historyRecords[0]?.specificMembers).toEqual([
			{
				id: "user-1",
				name: "Alice",
				type: "user",
			},
			{
				id: "dept-1",
				name: "Design",
				type: "department",
			},
		])
	})

	it("maps publish prefill payloads into a localized create draft", () => {
		expect(
			createSkillEditPublishPrefillDraft({
				prefill: {
					version: "2.0.0",
					version_description_i18n: {
						zh_CN: "版本说明",
						en_US: "Release notes",
					},
					publish_target_type: "MARKET",
					publish_target_value: null,
				},
				versions: [],
				fallbackDraft: {
					version: "",
					details: "",
					publishTo: "INTERNAL",
					internalTarget: "PRIVATE",
					specificMembers: [],
				},
			}),
		).toEqual({
			version: "v2.0.0",
			details: {
				default: "版本说明",
				zh_CN: "版本说明",
				en_US: "Release notes",
			},
			publishTo: "MARKET",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})
	})

	it("maps member prefill ids with the latest version members", () => {
		expect(
			createSkillEditPublishPrefillDraft({
				prefill: {
					version: "3.0.0",
					version_description_i18n: [],
					publish_target_type: "MEMBER",
					publish_target_value: {
						user_ids: ["user-1"],
						department_ids: ["dept-1"],
					},
				},
				versions: [
					{
						id: "version-1",
						version: "2.0.0",
						publish_status: "PUBLISHED",
						review_status: "APPROVED",
						publish_target_type: "MEMBER",
						publish_target_value: {
							users: [{ id: "user-1", name: "Alice" }],
							departments: [{ id: "dept-1", name: "Design" }],
						},
						publisher: null,
						published_at: "2026-03-22 10:00:00",
						is_current_version: true,
						version_description_i18n: null,
					},
				],
				fallbackDraft: {
					version: "",
					details: "",
					publishTo: "INTERNAL",
					internalTarget: "PRIVATE",
					specificMembers: [],
				},
			}),
		).toEqual({
			version: "v3.0.0",
			details: "",
			publishTo: "INTERNAL",
			internalTarget: "MEMBER",
			specificMembers: [
				{
					id: "user-1",
					name: "Alice",
					type: "user",
				},
				{
					id: "dept-1",
					name: "Design",
					type: "department",
				},
			],
		})
	})
})
