import { comparer, makeAutoObservable, runInAction, reaction } from "mobx"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { DraftData, DraftKey, QueueDraftMetadata, QueueDraftSnapshot } from "../../types"
import type { DataService } from "@/components/business/MentionPanel/types"
import { draftManager } from "../../services/draftService"
import { hasMeaningfulData } from "../../services/draftService/utils"
import {
	filterPendingCanvasMentionsFromContent,
	filterUploadFileMentionsFromContent,
	hasLoadingMarkerInContent,
} from "../../utils/mention"
import { cloneDeep, isEqual } from "lodash-es"
import i18next from "i18next"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"
import { userStore } from "@/models/user"
import { transformInspectorContent } from "../../extensions/inspector-detail"
import { collectMentionItemsFromContent } from "../../services/uploadMentionService"
import { EditorStore } from "../EditorStore"
import { syncDraftMarkersToSuperMagicManager } from "./lazy-super-magic-marker-manager"

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
	queueDraft: QueueDraftMetadata | undefined = undefined

	isDraftSwitching = false
	private switchEditable = true
	private loadRevision = 0

	private clearContentHandler: (() => void) | null = null
	private mentionPanelStore: MentionPanelStoreLike | null = null

	constructor(
		editorStore: EditorStore,
		private readonly areFilesUploaded: () => boolean = () => true,
	) {
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
		const nextKey = draftKey
			? {
					...draftKey,
					userId: userStore.user.userInfo?.user_id,
					organizationCode: userStore.user.userInfo?.organization_code,
				}
			: null
		if (!isEqual(this.draftKey, nextKey)) {
			this.loadRevision += 1
			this.queueDraft = undefined
			this.isDraftReady = false
		}
		this.draftKey = nextKey
	}

	/** Enables normal draft saving when the initial restore is skipped or fails. */
	markDraftReady() {
		this.isDraftReady = true
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
		if (!this.isDraftReady || this.isSendingGuard || this.isDraftSwitching || isComposing)
			return
		this.saveDraft({ value, mentionPanelStore })
	}

	saveDraft({ value, mentionPanelStore, shouldReloadDraftBox = true }: SaveDraftOptions) {
		if (this.isDraftSwitching) return
		if (hasLoadingMarkerInContent(value)) return

		const draftKey = this.getDraftKey()
		if (!draftKey) return

		const dataService = mentionPanelStore ?? this.mentionPanelStore ?? undefined
		const valueWithoutPending = filterPendingCanvasMentionsFromContent(value)
		const filteredValue =
			valueWithoutPending && dataService
				? filterUploadFileMentionsFromContent(valueWithoutPending, dataService, {
						preserveMentionValidation: this.editorStore.preserveMentionContent,
					})
				: valueWithoutPending

		draftManager.saveDraft({
			...draftKey,
			value: filteredValue,
			queueDraft: this.queueDraft,
			mentionItems: collectMentionItemsFromContent(filteredValue),
		})

		if (shouldReloadDraftBox) {
			this.reloadDraftBoxIfHidden()
		}
	}

	async saveDraftOnBlur({ value, mentionPanelStore, onError }: SaveDraftOnBlurOptions) {
		if (this.isSendingGuard || this.isDraftSwitching || (this.queueDraft && !this.isDraftReady))
			return
		if (hasLoadingMarkerInContent(value)) return

		const draftKey = this.getDraftKey()
		if (!draftKey) return

		const dataService = mentionPanelStore ?? this.mentionPanelStore ?? undefined
		const valueWithoutPending = filterPendingCanvasMentionsFromContent(value)
		const filteredValue =
			valueWithoutPending && dataService
				? filterUploadFileMentionsFromContent(valueWithoutPending, dataService, {
						preserveMentionValidation: this.editorStore.preserveMentionContent,
					})
				: valueWithoutPending

		try {
			await draftManager.saveDraft({
				...draftKey,
				value: filteredValue,
				queueDraft: this.queueDraft,
				mentionItems: collectMentionItemsFromContent(filteredValue),
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
			const valueWithoutPending = filterPendingCanvasMentionsFromContent(value)
			await draftManager.createSentDraft({
				...draftKey,
				value: valueWithoutPending,
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
			runInAction(() => {
				this.loadDraftPromise = null
			})
		})

		return this.loadDraftPromise
	}

	waitForLoadDraft() {
		return this.loadDraftPromise ?? Promise.resolve()
	}

	/** 主动替换共用同一确认：取消不保存、不取出；确认后暂停输入直到交接结束。 */
	async beginDraftSwitch(): Promise<boolean> {
		const requestedScope = this.getDraftKey()
		await this.waitForLoadDraft()
		if (!requestedScope || !this.matchesDraftScope(requestedScope)) return false
		if (
			this.isDraftSwitching ||
			this.isSendingGuard ||
			(this.queueDraft && this.queueDraft.phase !== "detached")
		) {
			magicToast.warning(i18next.t("messageQueue.operationInProgress", { ns: "super" }))
			return false
		}
		if (!this.areFilesUploaded()) {
			magicToast.warning(i18next.t("messageEditor.waitForFileUpload", { ns: "super" }))
			return false
		}
		if (hasLoadingMarkerInContent(this.editorStore.value)) {
			magicToast.warning(i18next.t("messageEditor.waitForMarkerLoad", { ns: "super" }))
			return false
		}
		this.isDraftSwitching = true
		const scope = this.getDraftKey()
		const revision = this.loadRevision
		const hasInput = hasMeaningfulData({
			value: this.editorStore.value,
			queueDraft: this.queueDraft,
		})
		const confirmed =
			!hasInput ||
			(await new Promise<boolean>((resolve) => {
				MagicModal.confirm({
					title: i18next.t("messageQueue.switchDraftTitle", { ns: "super" }),
					content: i18next.t("messageQueue.switchDraftContent", { ns: "super" }),
					okText: i18next.t("messageQueue.switchDraftConfirm", { ns: "super" }),
					cancelText: i18next.t("messageQueue.switchDraftCancel", { ns: "super" }),
					centered: true,
					onOk: () => {
						resolve(true)
					},
					onCancel: () => {
						resolve(false)
					},
				})
			}))
		if (
			!confirmed ||
			!scope ||
			!this.matchesDraftScope(scope) ||
			revision !== this.loadRevision
		) {
			this.isDraftSwitching = false
			return false
		}
		const editor = this.editorStore.tiptapEditor
		this.switchEditable = editor?.isEditable ?? true
		if (editor && !editor.isDestroyed) editor.setEditable(false)
		return true
	}

	endDraftSwitch() {
		if (!this.isDraftSwitching) return
		this.isDraftSwitching = false
		if (this.isDraftReady)
			this.saveDraft({ value: this.editorStore.value, shouldReloadDraftBox: false })
		void this.loadDraftVersions({ loading: false })
		const editor = this.editorStore.tiptapEditor
		if (editor && !editor.isDestroyed)
			editor.setEditable(this.switchEditable && this.queueDraft?.phase !== "removing")
	}

	async useDraft(
		selectedDraft: DraftData,
		mentionPanelStore?: MentionPanelStoreLike,
	): Promise<boolean> {
		if (!(await this.beginDraftSwitch())) return false
		const scope = this.getDraftKey()
		try {
			if (!scope) return false
			let draft = selectedDraft
			if (draft.queueDraft) {
				const pinned = this.pinQueueDraft({ ...draft, queueDraft: draft.queueDraft })
				if (!this.matchesDraftScope(pinned)) {
					magicToast.warning(
						i18next.t("messageQueue.draftTopicMismatch", { ns: "super" }),
					)
					return false
				}
				const canonical = await draftManager.loadDraftByVersion(
					pinned,
					`queue/${draft.queueDraft.clientSyncId}`,
				)
				// 历史版本可以复用正文，但提交状态以这一份队列草稿的最新记录为准。
				if (canonical) draft = { ...draft, queueDraft: canonical.queueDraft }
			}
			await draftManager.saveDraftStrict(
				{
					...scope,
					value: this.editorStore.value,
					mentionItems: collectMentionItemsFromContent(this.editorStore.value),
					queueDraft: this.queueDraft,
				},
				true,
				true,
			)
			if (!this.matchesDraftScope(scope)) return false
			const loaded = await this.activateDraft(
				{ ...draft, ...scope },
				{
					isClearContent: false,
					replaceDirectly: false,
					mentionPanelStore,
				},
			)
			if (!loaded) return false
			this.editorStore.focus()
			return true
		} finally {
			this.endDraftSwitch()
		}
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
			runInAction(() => {
				// 同一队列来源只展示 canonical 版本；不同消息即使正文相同也不合并。
				const canonicalIds = new Set(
					allDrafts
						.filter((draft) => draft.versionId?.startsWith("queue/"))
						.map((draft) => draft.versionId),
				)
				this.drafts = allDrafts.filter(
					(draft) =>
						!draft.queueDraft ||
						draft.versionId === `queue/${draft.queueDraft.clientSyncId}` ||
						!canonicalIds.has(`queue/${draft.queueDraft.clientSyncId}`),
				)
			})
		} catch (error) {
			console.error("Failed to load drafts:", error)
		} finally {
			if (options.loading) {
				runInAction(() => {
					this.isDraftsLoading = false
				})
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

	getQueueDraft(): QueueDraftSnapshot | null {
		if (!this.draftKey || !this.queueDraft) return null
		return {
			...this.draftKey,
			value: this.editorStore.value,
			mentionItems: collectMentionItemsFromContent(this.editorStore.value),
			queueDraft: this.queueDraft,
		}
	}

	subscribeQueueDraft(listener: (draft: QueueDraftSnapshot | null) => void) {
		// 来源保留重发位置，内容有效性只决定提示是否可见。清空后重写仍属于同一草稿，
		// 未知操作结果也不能因正文为空而丢失；仅空／非空变化通知，避免每次按键刷新队列。
		return reaction(
			() => ({
				draft: this.queueDraft,
				hasContent: Boolean(hasMeaningfulData({ value: this.editorStore.value })),
			}),
			() => listener(this.getQueueDraft()),
			{ fireImmediately: true, equals: comparer.shallow },
		)
	}

	async prepareQueueDraft(draft: QueueDraftSnapshot): Promise<void> {
		await this.waitForLoadDraft()
		if (!this.matchesDraftScope(draft)) throw new Error("queue_draft_scope_changed")
		if (hasLoadingMarkerInContent(this.editorStore.value))
			throw new Error("queue_draft_not_ready")
		await draftManager.saveDraftStrict(
			{
				...draft,
				value: this.editorStore.value,
				mentionItems: collectMentionItemsFromContent(this.editorStore.value),
				queueDraft: this.queueDraft,
			},
			true,
			true,
		)
		await draftManager.saveDraftStrict(this.pinQueueDraft(draft))
		await this.loadDraftVersions({ loading: false })
	}

	async restoreQueueDraft(
		draft: QueueDraftSnapshot,
		activate = true,
	): Promise<"activated" | "saved"> {
		const previousValue = cloneDeep(this.editorStore.value)
		if (
			!activate &&
			this.matchesDraftScope(draft) &&
			this.queueDraft?.clientSyncId === draft.queueDraft.clientSyncId
		) {
			this.queueDraft = cloneDeep(draft.queueDraft)
		}
		await draftManager.saveDraftStrict(
			this.pinQueueDraft(draft),
			false,
			!activate &&
				this.matchesDraftScope(draft) &&
				this.queueDraft?.clientSyncId === draft.queueDraft.clientSyncId,
		)
		if (
			!this.matchesDraftScope(draft) ||
			!activate ||
			!isEqual(previousValue, this.editorStore.value)
		)
			return "saved"
		const loaded = await this.activateDraft({
			...draft,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
		if (!loaded) return "saved"
		this.editorStore.focus()
		return "activated"
	}

	async keepQueueDraft(): Promise<void> {
		const draft = this.getQueueDraft()
		if (!draft) return
		await draftManager.saveDraftStrict(this.pinQueueDraft(draft))
		if (
			!this.matchesDraftScope(draft) ||
			this.queueDraft?.clientSyncId !== draft.queueDraft.clientSyncId ||
			!isEqual(this.editorStore.value, draft.value)
		)
			return
		// 保留已有版本，再写空输入；不调用任何重新入队接口。
		await draftManager.saveDraftStrict(
			{ ...draft, value: undefined, mentionItems: [], queueDraft: undefined },
			true,
			true,
		)
		if (!this.matchesDraftScope(draft) || !isEqual(this.editorStore.value, draft.value)) return
		runInAction(() => {
			this.queueDraft = undefined
			this.clearContentHandler?.()
		})
		await this.loadDraftVersions({ loading: false })
	}

	async completeQueueDraft(syncId: string, submittedValue?: JSONContent): Promise<boolean> {
		const draft = this.getQueueDraft()
		if (!draft || draft.queueDraft.clientSyncId !== syncId) return false
		const valueAtConfirmation = cloneDeep(this.editorStore.value)
		const shouldClear = isEqual(valueAtConfirmation, submittedValue)
		// 覆盖这一份队列草稿的来源信息，草稿箱再次恢复只复用内容。
		// 先停止给新输入附加旧来源，再排入严格保存，避免后续自动保存恢复旧提交意图。
		this.queueDraft = undefined
		try {
			await draftManager.saveDraftStrict({
				...this.pinQueueDraft(draft),
				queueDraft: undefined,
				versionId: `queue/${syncId}`,
			})
		} catch (error) {
			if (this.matchesDraftScope(draft) && this.queueDraft === undefined) {
				runInAction(() => {
					this.queueDraft = draft.queueDraft
				})
			}
			throw error
		}
		if (!this.matchesDraftScope(draft) || this.queueDraft !== undefined) return false
		runInAction(() => {
			this.queueDraft = undefined
		})
		if (shouldClear && isEqual(this.editorStore.value, valueAtConfirmation)) {
			await draftManager.saveDraftStrict(
				{ ...draft, value: undefined, mentionItems: [], queueDraft: undefined },
				true,
				true,
			)
			return (
				this.matchesDraftScope(draft) &&
				isEqual(this.editorStore.value, valueAtConfirmation)
			)
		}
		await draftManager.saveDraftStrict(
			{
				...draft,
				value: this.editorStore.value,
				mentionItems: collectMentionItemsFromContent(this.editorStore.value),
				queueDraft: undefined,
			},
			true,
			true,
		)
		return false
	}

	/** 只有实际加载且当前记录写入成功才完成切换；保存失败恢复原输入。 */
	private async activateDraft(
		draft: DraftData,
		options: LoadDraftOptions = {},
	): Promise<boolean> {
		const scope = this.getDraftKey()
		if (!scope) return false
		const previousValue = cloneDeep(this.editorStore.value)
		const previousQueueDraft = cloneDeep(this.queueDraft)
		if (!(await this.loadDraft(draft, options))) return false
		const activatedValue = cloneDeep(this.editorStore.value)
		try {
			await draftManager.saveDraftStrict(
				{ ...draft, ...scope, value: activatedValue },
				false,
				true,
			)
			return this.matchesDraftScope(scope) && isEqual(activatedValue, this.editorStore.value)
		} catch (error) {
			if (this.matchesDraftScope(scope) && isEqual(activatedValue, this.editorStore.value)) {
				runInAction(() => {
					this.queueDraft = previousQueueDraft
				})
				this.editorStore.updateContent(previousValue, { preserveMentionValidation: true })
			}
			throw error
		}
	}

	private pinQueueDraft(draft: QueueDraftSnapshot): QueueDraftSnapshot {
		return {
			...draft,
			userId: draft.queueDraft.userId,
			organizationCode: draft.queueDraft.organizationCode,
		}
	}

	private matchesDraftScope(draft: DraftKey): boolean {
		return Boolean(
			this.draftKey &&
			this.draftKey.projectId === draft.projectId &&
			this.draftKey.topicId === draft.topicId &&
			this.draftKey.workspaceId === draft.workspaceId &&
			(!draft.userId || draft.userId === userStore.user.userInfo?.user_id) &&
			(!draft.organizationCode ||
				draft.organizationCode === userStore.user.userInfo?.organization_code),
		)
	}

	dispose() {
		this.loadRevision += 1
		this.clearContentHandler = null
		this.mentionPanelStore = null
		this.loadDraftPromise = null
	}

	private async loadLatestDraftInternal(draftKey: DraftKey, options: LoadDraftOptions) {
		const draft = await draftManager.loadLatestDraftVersion(draftKey)
		if (this.matchesDraftScope(draftKey)) await this.loadDraft(draft, options)
	}

	private async loadDraft(
		draft: DraftData | null,
		{ isClearContent = true, replaceDirectly = true, mentionPanelStore }: LoadDraftOptions = {},
	) {
		const revision = ++this.loadRevision
		const previousValue = cloneDeep(this.editorStore.value)
		this.isDraftReady = false

		if (!draft) {
			this.queueDraft = undefined
			if (isClearContent) {
				this.clearContentHandler?.()
			}
			this.isDraftReady = true
			return true
		}

		const loadScope = this.draftKey
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
		if (!loadScope || !this.matchesDraftScope(loadScope) || this.loadRevision !== revision)
			return
		if (
			draft.queueDraft &&
			!this.matchesDraftScope(this.pinQueueDraft({ ...draft, queueDraft: draft.queueDraft }))
		)
			return
		if (replaceDirectly ? draft.value || draft.isCurrentSnapshot : true) {
			await syncDraftMarkersToSuperMagicManager(draft)
			if (!this.matchesDraftScope(loadScope) || this.loadRevision !== revision) return

			const valueWithoutPending = filterPendingCanvasMentionsFromContent(draft.value)
			const filteredContent =
				valueWithoutPending && dataService
					? filterUploadFileMentionsFromContent(valueWithoutPending, dataService, {
							preserveMentionValidation: true,
						})
					: valueWithoutPending
			if (!isEqual(previousValue, this.editorStore.value)) {
				this.markDraftReady()
				return
			}
			runInAction(() => {
				this.queueDraft = draft.queueDraft ? cloneDeep(draft.queueDraft) : undefined
			})
			// 来源变更会通知队列恢复模型；切换完成前仍保持输入暂停。
			if (this.isDraftSwitching) this.editorStore.tiptapEditor?.setEditable(false)
			this.editorStore.updateContent(
				draft.queueDraft && filteredContent
					? transformInspectorContent(filteredContent)
					: filteredContent,
				{ preserveMentionValidation: true },
			)
		}

		runInAction(() => {
			if (!draft.queueDraft) this.queueDraft = undefined
			this.isDraftReady = true
		})
		return true
	}

	getDraftKey() {
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
			this.resetSendingGuard()
		}, 1000)
	}
}
