import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"

export type PublishPanelView = "history" | "create" | "detail"

export type PublishRecordStatus = "under_review" | "rejected" | "published"

export type PublishTo = "INTERNAL" | "MARKET"

export type PublishInternalTarget = "PRIVATE" | "MEMBER" | "ORGANIZATION"

export type PublishTarget = PublishInternalTarget | "MARKET"

export type PublishReviewStepState = "pending" | "current" | "done" | "failed"

export interface PublishSpecificMember {
	id: string
	name: string
	avatar?: string
	type: "user" | "department"
}

export interface PublishReviewProgress {
	submit: PublishReviewStepState
	review: PublishReviewStepState
	published: PublishReviewStepState
	failureReason?: string
}

export interface PublishHistoryRecord {
	id: string
	version: string
	versionDetails: string
	status: PublishRecordStatus
	publishTo: PublishTo
	internalTarget?: PublishInternalTarget
	publisherName: string
	publishedAt: string
	specificMembers?: PublishSpecificMember[]
	skillsLibraryReview?: PublishReviewProgress
}

export interface PublishDraft {
	version: string
	details: LocaleText
	publishTo: PublishTo
	internalTarget: PublishInternalTarget
	specificMembers: PublishSpecificMember[]
}

export interface PublishMarketCopy {
	publishToLabelKey: string
	publishToDescriptionKey: string
	targetLabelKey: string
	targetDescriptionKey: string
}

export interface PublishPanelData {
	hasUnpublishedChanges: boolean
	currentPublisherName: string
	historyRecords: PublishHistoryRecord[]
	draft: PublishDraft
	marketCopy: PublishMarketCopy
	availablePublishTo: PublishTo[]
	availableInternalTargets: PublishInternalTarget[]
}
