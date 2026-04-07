import { describe, expect, it } from "vitest"
import {
	buildPublishParamsFromDraft,
	createCrewEditPublishPanelData,
	createCrewEditPublishPrefillDraft,
} from "./publishPanelData"
import { resolveNextCrewPublishVersion } from "../../../utils/publishVersion"

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

	it("uses detail publish availability for market-only crews", () => {
		const data = createCrewEditPublishPanelData({
			agentDetail: {
				id: "agent-1",
				agent_code: "agent_1",
				name_i18n: { default: "Agent 1", zh_CN: "Agent 1", en_US: "Agent 1" },
				role_i18n: { default: ["Role"], zh_CN: ["Role"], en_US: ["Role"] },
				description_i18n: {
					default: "Description",
					zh_CN: "Description",
					en_US: "Description",
				},
				icon: null,
				prompt: null,
				enabled: true,
				source_type: "LOCAL_CREATE",
				is_store_offline: null,
				pinned_at: null,
				latest_published_at: "2026-03-20 12:00:00",
				skills: [],
				features: [],
				created_at: "2026-03-19 12:00:00",
				updated_at: "2026-03-20 12:00:00",
				project_id: null,
				publish_type: "MARKET",
				allowed_publish_target_types: [],
			},
			versions: [],
			locale: "zh_CN",
		})

		expect(data.availablePublishTo).toEqual(["MARKET"])
		expect(data.availableInternalTargets).toEqual([])
		expect(data.draft.publishTo).toBe("MARKET")
		expect(data.draft.version).toBe("v1.0.0")
	})

	it("uses detail publish availability for internal crew targets", () => {
		const data = createCrewEditPublishPanelData({
			agentDetail: {
				id: "agent-1",
				agent_code: "agent_1",
				name_i18n: { default: "Agent 1", zh_CN: "Agent 1", en_US: "Agent 1" },
				role_i18n: { default: ["Role"], zh_CN: ["Role"], en_US: ["Role"] },
				description_i18n: {
					default: "Description",
					zh_CN: "Description",
					en_US: "Description",
				},
				icon: null,
				prompt: null,
				enabled: true,
				source_type: "LOCAL_CREATE",
				is_store_offline: null,
				pinned_at: null,
				latest_published_at: "2026-03-20 12:00:00",
				skills: [],
				features: [],
				created_at: "2026-03-19 12:00:00",
				updated_at: "2026-03-20 12:00:00",
				project_id: null,
				publish_type: "INTERNAL",
				allowed_publish_target_types: ["PRIVATE", "MEMBER", "ORGANIZATION"],
			},
			versions: [],
			locale: "zh_CN",
		})

		expect(data.availablePublishTo).toEqual(["INTERNAL"])
		expect(data.availableInternalTargets).toEqual(["PRIVATE", "MEMBER", "ORGANIZATION"])
		expect(data.draft.publishTo).toBe("INTERNAL")
		expect(data.draft.internalTarget).toBe("PRIVATE")
		expect(data.draft.version).toBe("v1.0.0")
	})

	it("suggests the next patch version from the latest published history", () => {
		const data = createCrewEditPublishPanelData({
			agentDetail: {
				id: "agent-1",
				agent_code: "agent_1",
				name_i18n: { default: "Agent 1", zh_CN: "Agent 1", en_US: "Agent 1" },
				role_i18n: { default: ["Role"], zh_CN: ["Role"], en_US: ["Role"] },
				description_i18n: {
					default: "Description",
					zh_CN: "Description",
					en_US: "Description",
				},
				icon: null,
				prompt: null,
				enabled: true,
				source_type: "LOCAL_CREATE",
				is_store_offline: null,
				pinned_at: null,
				latest_published_at: "2026-03-20 12:00:00",
				version_code: "3.4.5",
				skills: [],
				features: [],
				created_at: "2026-03-19 12:00:00",
				updated_at: "2026-03-20 12:00:00",
				project_id: null,
				publish_type: "INTERNAL",
				allowed_publish_target_types: ["PRIVATE"],
			},
			versions: [
				{
					id: "version-rejected",
					version: "9.9.9",
					publish_status: "OFFLINE",
					review_status: "REJECTED",
					publish_target_type: "PRIVATE",
					publish_to_label: "Private",
					publisher: null,
					published_at: null,
					display_time: "",
					is_current_version: false,
					version_description_i18n: null,
				},
				{
					id: "version-published",
					version: "2.3.4",
					publish_status: "PUBLISHED",
					review_status: "APPROVED",
					publish_target_type: "PRIVATE",
					publish_to_label: "Private",
					publisher: null,
					published_at: "2026-03-20 12:00:00",
					display_time: "2026-03-20 12:00:00",
					is_current_version: true,
					version_description_i18n: null,
				},
			],
			locale: "zh_CN",
		})

		expect(data.draft.version).toBe("v2.3.5")
	})

	it("maps member publish targets into version detail members", () => {
		const data = createCrewEditPublishPanelData({
			agentDetail: {
				id: "agent-1",
				agent_code: "agent_1",
				name_i18n: { default: "Agent 1", zh_CN: "Agent 1", en_US: "Agent 1" },
				role_i18n: { default: ["Role"], zh_CN: ["Role"], en_US: ["Role"] },
				description_i18n: {
					default: "Description",
					zh_CN: "Description",
					en_US: "Description",
				},
				icon: null,
				prompt: null,
				enabled: true,
				source_type: "LOCAL_CREATE",
				is_store_offline: null,
				pinned_at: null,
				latest_published_at: "2026-03-20 12:00:00",
				skills: [],
				features: [],
				created_at: "2026-03-19 12:00:00",
				updated_at: "2026-03-20 12:00:00",
				project_id: null,
				publish_type: "INTERNAL",
				allowed_publish_target_types: ["PRIVATE", "MEMBER", "ORGANIZATION"],
			},
			versions: [
				{
					id: "version-member",
					version: "1.0.0",
					publish_status: "PUBLISHED",
					review_status: "APPROVED",
					publish_target_type: "MEMBER",
					publish_target_value: {
						users: [{ id: "user-1", name: "Alice" }],
						departments: [{ id: "dept-1", name: "Design" }],
					},
					publish_to_label: "Member",
					publisher: null,
					published_at: "2026-03-22 10:00:00",
					display_time: "2026-03-22 10:00:00",
					is_current_version: true,
					version_description_i18n: null,
				},
			],
			locale: "zh_CN",
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
			createCrewEditPublishPrefillDraft({
				prefill: {
					version: "2.0.0",
					version_description_i18n: {
						default: "版本说明",
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
			createCrewEditPublishPrefillDraft({
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
						publish_to_label: "Member",
						publisher: null,
						published_at: "2026-03-22 10:00:00",
						display_time: "2026-03-22 10:00:00",
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

describe("resolveNextCrewPublishVersion", () => {
	it("returns the first publish version when no version exists", () => {
		expect(resolveNextCrewPublishVersion()).toBe("v1.0.0")
	})

	it("increments the last numeric segment", () => {
		expect(resolveNextCrewPublishVersion("1.2.9")).toBe("v1.2.10")
		expect(resolveNextCrewPublishVersion("V7.5")).toBe("v7.6")
	})
})
