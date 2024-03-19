import { makeAutoObservable } from "mobx"
import type { JSONContent } from "@tiptap/react"
import type { DraftData, DraftKey } from "../../types"
import type { DataService } from "@/opensource/components/business/MentionPanel/types"
import { draftManager } from "../../services/draftService"
import { hasMeaningfulData } from "../../services/draftService/utils"
import {
	filterUploadFileMentionsFromContent,
	hasLoadingMarkerInContent,
	syncDraftMarkersToManager,
} from "../../utils/mention"
import { SuperMagicMarkerManager } from "@/opensource/pages/superMagic/components/Detail/contents/Design/marker-manager"
import { EditorStore } from "../EditorStore"

interface MentionPanelStoreLike extends DataService {
	getInitLoadAttachmentsPromise?: (projectId: string) => Promise<unknown>
}

interface LoadDraftOptions {
	isClearContent?: boolean
	replaceDirectly?: boolean
	mentionPanelStore?: MentionPanelStoreLike
}

interface SaveDraftOptions {
	value: JSONContent | undefined
	mentionPanelStore?: DataService
	shouldReloadDraftBox?: boolean
}

interface SaveDraftOnBlurOptions {
	value: JSONContent | undefined
	mentionPanelStore?: DataService
	onError?: (error: unknown) => void
}

interface CreateSentDraftOptions {
	value: JSONContent | undefined
	onError?: (error: unknown) => void
}

export class DraftStore {
	editorStore: EditorStore
	draftKey: DraftKey | null = null
	isDraftReady = false
	isSendingGuard = false
	loadDraftPromise: Promise<void> | null = null
	isDraftsLoading = false
	drafts: DraftData[] = []

	private clearContentHandler: (() => void) | null = null
	private mentionPanelStore: MentionPanelStoreLike | null = null

	constructor(editorStore: EditorStore) {
		this.editorStore = editorStore

		makeAutoObservable(
			this,
			{},
			{
				autoBind: true,
			},
		)
	}

	setDraftKey(draftKey: DraftKey | null) {
		this.draftKey = draftKey
	}

	setClearContentHandler(handler: () => void) {
		this.clearContentHandler = handler
	}

	setMentionPanelStore(store: MentionPanelStoreLike) {
		this.mentionPanelStore = store
	}

	startSendingGuard() {
		this.isSendingGuard = true
	}

	resetSendingGuard() {
		this.isSendingGuard = false
	}

	handleContentChange({
		value,
		mentionPanelStore,
		isComposing,
	}: {
		value: JSONContent | undefined
		mentionPanelStore?: DataService
		isComposing: boolean
	}) {
		if (!this.isDraftReady || this.isSendingGuard || isComposing) return
		this.saveDraft({ value, mentionPanelStore })
	}

	saveDraft({ value, mentionPanelStore, shouldReloadDraftBox = true }: SaveDraftOptions) {
		if (hasLoadingMarkerInContent(value)) return

		const draftKey = this.getDraftKey()
		if (!draftKey) return

		const dataService = mentionPanelStore ?? this.mentionPanelStore ?? undefined
		const filteredValue =
			value && dataService ? filterUploadFileMentionsFromContent(value, dataService) : value

		draftManager.saveDraft({
			...draftKey,
			value: filteredValue,
		})

		if (shouldReloadDraftBox) {
			this.reloadDraftBoxIfHidden()
		}
	}

	async saveDraftOnBlur({ value, mentionPanelStore, onError }: SaveDraftOnBlurOptions) {
		if (this.isSendingGuard) return
		if (hasLoadingMarkerInContent(value)) return

		const draftKey = this.getDraftKey()
		if (!draftKey) return

		const dataService = mentionPanelStore ?? this.mentionPanelStore ?? undefined
		const filteredValue =
			value && dataService ? filterUploadFileMentionsFromContent(value, dataService) : value

		try {
			await draftManager.saveDraft({
				...draftKey,
				value: filteredValue,
			})
		} catch (error) {
			onError?.(error)
		}
	}

	async createSentDraft({ value, onError }: CreateSentDraftOptions) {
		const draftKey = this.getDraftKey()
		if (!draftKey) {
			this.scheduleSendingGuardReset()
			return
		}

		try {
			await draftManager.createSentDraft({
				...draftKey,
				value,
			})
			await this.loadDraftVersions({ loading: false })
		} catch (error) {
			onError?.(error)
		} finally {
			this.scheduleSendingGuardReset()
		}
	}

	async loadLatestDraft(options: LoadDraftOptions = {}) {
		const draftKey = this.getDraftKey()
		if (!draftKey) return

		const loadPromise = this.loadLatestDraftInternal(draftKey, options)
		this.loadDraftPromise = loadPromise.finally(() => {
			this.loadDraftPromise = null
		})

		return this.loadDraftPromise
	}

	waitForLoadDraft() {
		return this.loadDraftPromise ?? Promise.resolve()
	}

	async useDraft(draft: DraftData, mentionPanelStore?: MentionPanelStoreLike) {
		await this.loadDraft(draft, {
			isClearContent: false,
			replaceDirectly: false,
			mentionPanelStore,
		})
		this.editorStore.focus()
	}

	async loadDraftVersions(options: { loading?: boolean } = { loading: true }) {
		const draftKey = this.getDraftKey()
		if (!draftKey) return

		if (options.loading) {
			this.isDraftsLoading = true
		}

		try {
			const versions = await draftManager.loadProjectDraftVersions({
				workspaceId: draftKey.workspaceId,
				projectId: draftKey.projectId,
			})

			const allDrafts: DraftData[] = []

			for (const version of versions) {
				const versionKey = {
					workspaceId: draftKey.workspaceId,
					projectId: draftKey.projectId,
					topicId: version.topicId || draftKey.topicId,
				}
				const versionData = await draftManager.loadDraftByVersion(
					versionKey,
					version.versionId,
				)
				if (versionData && hasMeaningfulData(versionData)) {
					allDrafts.push(versionData)
				}
			}

			allDrafts.sort((a, b) => b.updatedAt - a.updatedAt)
			this.drafts = allDrafts
		} catch (error) {
			console.error("Failed to load drafts:", error)
		} finally {
			if (options.loading) {
				this.isDraftsLoading = false
			}
		}
	}

	async deleteDraftVersion(draft: DraftData) {
		if (!draft.versionId) return

		const baseKey = this.getDraftKey()
		const draftKey = {
			workspaceId: draft.workspaceId || baseKey?.workspaceId || "global",
			projectId: draft.projectId || baseKey?.projectId || "",
			topicId: draft.topicId || baseKey?.topicId || "",
		}

		if (!draftKey.projectId || !draftKey.topicId) return

		try {
			await draftManager.deleteDraftVersion(draftKey, draft.versionId)
			await this.loadDraftVersions({ loading: false })
		} catch (error) {
			console.error("Failed to delete draft:", error)
		}
	}

	dispose() {
		this.clearContentHandler = null
		this.mentionPanelStore = null
		this.loadDraftPromise = null
	}

	private async loadLatestDraftInternal(draftKey: DraftKey, options: LoadDraftOptions) {
		const draft = await draftManager.loadLatestDraftVersion(draftKey)
		await this.loadDraft(draft, options)
	}

	private async loadDraft(
		draft: DraftData | null,
		{ isClearContent = true, replaceDirectly = true, mentionPanelStore }: LoadDraftOptions = {},
	) {
		this.isDraftReady = false

		if (!draft) {
			if (isClearContent) {
				this.clearContentHandler?.()
			}
			this.isDraftReady = true
			return
		}

		const dataService = mentionPanelStore ?? this.mentionPanelStore ?? undefined
		try {
			const projectId = this.draftKey?.projectId || draft.projectId
			const preloadPromise = dataService?.getInitLoadAttachmentsPromise?.(projectId)

			if (preloadPromise) {
				const result = await Promise.race([
					Promise.all([preloadPromise]),
					new Promise((resolve) =>
						setTimeout(() => {
							resolve("timeout")
						}, 2000),
					),
				])

				if (result === "timeout")
					console.warn("Preload mention list timed out, continuing with draft loading...")
			}
		} catch (error) {
			console.error("Failed to preload mention list:", error)
		}

		if (replaceDirectly ? draft.value : true) {
			// 草稿恢复前，将 marker 同步到 Manager，便于 Design 画布显示，避免被误判为 stale
			const markerManager = SuperMagicMarkerManager.getInstance()
			syncDraftMarkersToManager(draft, (data) => {
				markerManager.syncFromCanvasMarkerMentionData(data)
			})

			const filteredContent =
				draft.value && dataService
					? filterUploadFileMentionsFromContent(draft.value, dataService)
					: draft.value
			this.editorStore.updateContent(filteredContent)
		}

		this.isDraftReady = true
	}

	private getDraftKey() {
		if (!this.draftKey) return null
		return this.draftKey
	}

	private reloadDraftBoxIfHidden() {
		if (this.drafts.length > 0) return

		setTimeout(() => {
			this.loadDraftVersions({ loading: false })
		}, 1000)
	}

	private scheduleSendingGuardReset() {
		// Keep delayed reset to avoid blur save race
		setTimeout(() => {
			this.isSendingGuard = false
		}, 1000)
	}
}
