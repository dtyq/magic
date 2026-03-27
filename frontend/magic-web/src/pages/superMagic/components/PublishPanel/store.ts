import { makeAutoObservable } from "mobx"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import { normalizeDraftForAvailability, sanitizeDraftForSubmission } from "./publishAvailability"
import type {
	PublishDraft,
	PublishHistoryRecord,
	PublishInternalTarget,
	PublishMarketCopy,
	PublishPanelData,
	PublishPanelView,
	PublishTo,
} from "./types"

interface PublishPanelStoreOptions {
	initialData: PublishPanelData
	onSubmit?: (draft: PublishDraft) => Promise<void> | void
	onViewRecord?: (record: PublishHistoryRecord) => void
}

interface PublishPanelHydrateOptions {
	preserveDraft?: boolean
	preserveView?: boolean
}

export class PublishPanelStore {
	view: PublishPanelView = "history"
	hasUnpublishedChanges = false
	currentPublisherName = ""
	historyRecords: PublishHistoryRecord[] = []
	selectedHistoryRecord: PublishHistoryRecord | null = null
	marketCopy: PublishMarketCopy = {
		publishToLabelKey: "skillEditPage.publishPanel.publishToOptions.skills_library.label",
		publishToDescriptionKey:
			"skillEditPage.publishPanel.publishToOptions.skills_library.description",
		targetLabelKey: "skillEditPage.publishPanel.targets.skills_library.label",
		targetDescriptionKey: "skillEditPage.publishPanel.targets.skills_library.description",
	}
	draft: PublishDraft = {
		version: "",
		details: "",
		publishTo: "INTERNAL",
		internalTarget: "PRIVATE",
		specificMembers: [],
	}
	availablePublishTo: PublishTo[] = []
	availableInternalTargets: PublishInternalTarget[] = []
	isSubmitting = false

	private initialDraft: PublishDraft = {
		version: "",
		details: "",
		publishTo: "INTERNAL",
		internalTarget: "PRIVATE",
		specificMembers: [],
	}

	private readonly onSubmit?: PublishPanelStoreOptions["onSubmit"]
	private readonly onViewRecord?: PublishPanelStoreOptions["onViewRecord"]

	constructor({ initialData, onSubmit, onViewRecord }: PublishPanelStoreOptions) {
		makeAutoObservable(this, {}, { autoBind: true })

		this.onSubmit = onSubmit
		this.onViewRecord = onViewRecord
		this.hydrate(initialData)
	}

	get canSubmit() {
		if (!this.availablePublishTo.includes(this.draft.publishTo)) return false
		if (
			this.draft.publishTo === "INTERNAL" &&
			!this.availableInternalTargets.includes(this.draft.internalTarget)
		)
			return false
		if (this.draft.version.trim().length === 0) return false

		if (this.requiresSpecificMembers) return this.draft.specificMembers.length > 0

		return true
	}

	get requiresSpecificMembers() {
		return this.draft.publishTo === "INTERNAL" && this.draft.internalTarget === "MEMBER"
	}

	get effectiveTarget() {
		if (this.draft.publishTo === "MARKET") return "skills_library" as const
		return this.draft.internalTarget
	}

	isPublishToSelected(publishTo: PublishTo) {
		return this.draft.publishTo === publishTo
	}

	isInternalTargetSelected(target: PublishInternalTarget) {
		return this.draft.internalTarget === target
	}

	hydrate(data: PublishPanelData, options: PublishPanelHydrateOptions = {}) {
		const { preserveDraft = false, preserveView = false } = options
		this.hasUnpublishedChanges = data.hasUnpublishedChanges
		this.currentPublisherName = data.currentPublisherName
		this.marketCopy = data.marketCopy ?? this.marketCopy
		this.historyRecords = data.historyRecords.map((record) => ({
			...record,
			specificMembers: record.specificMembers ? [...record.specificMembers] : undefined,
		}))
		this.availablePublishTo = [...data.availablePublishTo]
		this.availableInternalTargets = [...data.availableInternalTargets]
		this.initialDraft = this.normalizeDraft(data.draft)
		if (!preserveDraft) this.resetDraft()
		if (preserveDraft) this.draft = this.normalizeDraft(this.draft)
		if (!preserveView) {
			this.selectedHistoryRecord = null
			this.view = "history"
			return
		}

		if (this.view !== "detail" || !this.selectedHistoryRecord) return
		this.selectedHistoryRecord =
			this.historyRecords.find((record) => record.id === this.selectedHistoryRecord?.id) ??
			null
	}

	openCreateView() {
		this.selectedHistoryRecord = null
		this.view = "create"
	}

	openCreateViewWithDraft(draft: PublishDraft) {
		this.selectedHistoryRecord = null
		this.draft = this.normalizeDraft(draft)
		this.view = "create"
	}

	openHistoryView() {
		this.selectedHistoryRecord = null
		this.view = "history"
	}

	openDetailView(record: PublishHistoryRecord) {
		this.selectedHistoryRecord = {
			...record,
			specificMembers: record.specificMembers ? [...record.specificMembers] : undefined,
		}
		this.view = "detail"
	}

	setVersion(version: string) {
		this.draft = {
			...this.draft,
			version,
		}
	}

	setDetails(details: PublishDraft["details"]) {
		this.draft = {
			...this.draft,
			details,
		}
	}

	selectPublishTo(publishTo: PublishTo) {
		if (!this.availablePublishTo.includes(publishTo)) return
		if (this.draft.publishTo === publishTo) return

		this.draft = {
			...this.draft,
			publishTo,
		}
	}

	selectInternalTarget(target: PublishInternalTarget) {
		if (!this.availableInternalTargets.includes(target)) return
		if (this.draft.internalTarget === target) return

		this.draft = {
			...this.draft,
			publishTo: "INTERNAL",
			internalTarget: target,
		}
	}

	setSpecificMembers(specificMembers: PublishDraft["specificMembers"]) {
		this.draft = {
			...this.draft,
			specificMembers,
		}
	}

	setSpecificMemberScopeLabel() {
		// Keep a temporary compatibility shim for hot reload.
	}

	resetDraft() {
		this.draft = this.normalizeDraft(this.initialDraft)
	}

	viewRecord(record: PublishHistoryRecord) {
		this.openDetailView(record)
		this.onViewRecord?.(record)
	}

	async submitDraft() {
		if (!this.canSubmit || this.isSubmitting) return

		this.isSubmitting = true
		const submissionDraft = sanitizeDraftForSubmission(this.draft)

		try {
			if (this.onSubmit) {
				await this.onSubmit(submissionDraft)
			} else {
				this.historyRecords = [
					{
						id: `record-${submissionDraft.version}`,
						version: submissionDraft.version,
						versionDetails: localeTextToDisplayString(submissionDraft.details),
						status: "under_review",
						publishTo: submissionDraft.publishTo,
						internalTarget:
							submissionDraft.publishTo === "INTERNAL"
								? submissionDraft.internalTarget
								: undefined,
						publisherName: this.currentPublisherName,
						publishedAt: formatPublishTimestamp(new Date()),
						specificMembers:
							submissionDraft.publishTo === "INTERNAL" &&
							submissionDraft.internalTarget === "MEMBER"
								? [...submissionDraft.specificMembers]
								: undefined,
						skillsLibraryReview:
							submissionDraft.publishTo === "MARKET"
								? {
										submit: "done",
										review: "current",
										published: "pending",
									}
								: undefined,
					},
					...this.historyRecords,
				]
				this.hasUnpublishedChanges = false
			}

			this.resetDraft()
			this.openHistoryView()
		} finally {
			this.isSubmitting = false
		}
	}

	private normalizeDraft(draft: PublishDraft) {
		return normalizeDraftForAvailability({
			draft: {
				...draft,
				specificMembers: [...draft.specificMembers],
			},
			availablePublishTo: this.availablePublishTo,
			availableInternalTargets: this.availableInternalTargets,
		})
	}
}

function formatPublishTimestamp(date: Date) {
	return date.toISOString().slice(0, 19).replace("T", " ")
}
