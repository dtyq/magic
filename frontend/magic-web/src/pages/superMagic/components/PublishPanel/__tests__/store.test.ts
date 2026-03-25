import { describe, expect, it } from "vitest"
import { DEFAULT_LOCALE_KEY } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { PublishPanelStore } from "../store"
import type { PublishPanelData } from "../types"

function createPanelData(): PublishPanelData {
	return {
		hasUnpublishedChanges: true,
		currentPublisherName: "Username",
		historyRecords: [
			{
				id: "record-v1-5",
				version: "V1.5",
				versionDetails: "Release details",
				status: "under_review",
				publishTo: "MARKET",
				publisherName: "Username",
				publishedAt: "2026-03-13 12:00:00",
				skillsLibraryReview: {
					submit: "done",
					review: "current",
					published: "pending",
				},
			},
		],
		draft: {
			version: "",
			details: "",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		},
		marketCopy: {
			publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.skills_library.label",
			publishToDescriptionKey:
				"skillEditPage.publishPanel.publishToOptions.skills_library.description",
			targetLabelKey: "skillEditPage.publishPanel.targets.skills_library.label",
			targetDescriptionKey: "skillEditPage.publishPanel.targets.skills_library.description",
		},
		availablePublishTo: ["INTERNAL", "MARKET"],
		availableInternalTargets: ["PRIVATE", "MEMBER", "ORGANIZATION"],
	}
}

describe("PublishPanelStore", () => {
	it("switches between history and create views", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateView()
		expect(store.view).toBe("create")

		store.openHistoryView()
		expect(store.view).toBe("history")
	})

	it("opens create view with a prefilled draft", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateViewWithDraft({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})

		expect(store.view).toBe("create")
		expect(store.draft).toEqual({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})
	})

	it("normalizes create drafts when only market publishing is available", () => {
		const store = new PublishPanelStore({
			initialData: {
				...createPanelData(),
				draft: {
					version: "",
					details: "",
					publishTo: "MARKET",
					internalTarget: "PRIVATE",
					specificMembers: [],
				},
				availablePublishTo: ["MARKET"],
				availableInternalTargets: [],
			},
		})

		store.openCreateViewWithDraft({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})

		expect(store.draft.publishTo).toBe("MARKET")
	})

	it("preserves create view and draft when hydrating with preserve options", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateViewWithDraft({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})

		store.hydrate(
			{
				...createPanelData(),
				historyRecords: [],
			},
			{
				preserveDraft: true,
				preserveView: true,
			},
		)

		expect(store.view).toBe("create")
		expect(store.draft).toEqual({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})
	})

	it("normalizes preserved drafts against refreshed availability", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateViewWithDraft({
			version: "v1.0.0",
			details: "Imported skill description",
			publishTo: "INTERNAL",
			internalTarget: "PRIVATE",
			specificMembers: [],
		})

		store.hydrate(
			{
				...createPanelData(),
				availablePublishTo: ["MARKET"],
				availableInternalTargets: [],
				draft: {
					version: "",
					details: "",
					publishTo: "MARKET",
					internalTarget: "PRIVATE",
					specificMembers: [],
				},
			},
			{
				preserveDraft: true,
				preserveView: true,
			},
		)

		expect(store.view).toBe("create")
		expect(store.draft.publishTo).toBe("MARKET")
	})

	it("keeps the existing market copy when hydrated data misses it", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.hydrate({
			...createPanelData(),
			marketCopy: undefined as never,
		})

		expect(store.marketCopy.targetLabelKey).toBe(
			"skillEditPage.publishPanel.targets.skills_library.label",
		)
	})

	it("updates the draft and internal target selection", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.setVersion("V1.6")
		store.selectInternalTarget("ORGANIZATION")

		expect(store.draft).toEqual({
			version: "V1.6",
			details: "",
			publishTo: "INTERNAL",
			internalTarget: "ORGANIZATION",
			specificMembers: [],
		})
		expect(store.canSubmit).toBe(true)
	})

	it("allows empty details when version is present", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.setVersion("V1.6")

		expect(store.canSubmit).toBe(true)
	})

	it("allows localized details when default text is present", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.setVersion("V1.6")
		store.setDetails({
			[DEFAULT_LOCALE_KEY]: "Release details",
			en_US: "Release details",
			zh_CN: "发布说明",
		})

		expect(store.canSubmit).toBe(true)
	})

	it("preserves specific members when switching publish targets", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.selectInternalTarget("MEMBER")
		store.setSpecificMembers([
			{
				id: "user-1",
				name: "Alice",
				type: "user",
			},
		])
		store.selectPublishTo("MARKET")
		store.selectPublishTo("INTERNAL")

		expect(store.draft.publishTo).toBe("INTERNAL")
		expect(store.draft.internalTarget).toBe("MEMBER")
		expect(store.draft.specificMembers).toEqual([
			{
				id: "user-1",
				name: "Alice",
				type: "user",
			},
		])
	})

	it("preserves hidden specific members when hydrating draft availability", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateView()
		store.selectInternalTarget("MEMBER")
		store.setSpecificMembers([
			{
				id: "dept-1",
				name: "Marketing",
				type: "department",
			},
		])
		store.selectPublishTo("MARKET")

		store.hydrate(createPanelData(), {
			preserveDraft: true,
			preserveView: true,
		})

		expect(store.draft.publishTo).toBe("MARKET")
		expect(store.draft.specificMembers).toEqual([
			{
				id: "dept-1",
				name: "Marketing",
				type: "department",
			},
		])
	})

	it("requires selected targets for specific member publishing", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.setVersion("V1.6")
		store.selectInternalTarget("MEMBER")

		expect(store.canSubmit).toBe(false)

		store.setSpecificMembers([
			{
				id: "dept-1",
				name: "Marketing",
				type: "department",
			},
		])

		expect(store.canSubmit).toBe(true)
	})

	it("opens detail view when viewing a history record", () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})
		const firstRecord = store.historyRecords[0]

		expect(firstRecord).toBeDefined()
		if (!firstRecord) return

		store.viewRecord(firstRecord)

		expect(store.view).toBe("detail")
		expect(store.selectedHistoryRecord?.id).toBe("record-v1-5")
	})

	it("submits the draft into the history list when no handler is provided", async () => {
		const store = new PublishPanelStore({
			initialData: createPanelData(),
		})

		store.openCreateView()
		store.setVersion("V1.6")

		await store.submitDraft()

		expect(store.view).toBe("history")
		expect(store.historyRecords[0]?.version).toBe("V1.6")
		expect(store.historyRecords[0]?.versionDetails).toBe("")
		expect(store.historyRecords[0]?.status).toBe("under_review")
		expect(store.historyRecords[0]?.publishTo).toBe("INTERNAL")
		expect(store.draft.version).toBe("")
		expect(store.draft.details).toBe("")
	})
})
