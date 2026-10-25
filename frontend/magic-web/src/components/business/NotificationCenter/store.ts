import { makeAutoObservable, runInAction } from "mobx"
import i18next from "i18next"
import { NotificationApi } from "@/apis"
import type { NotificationCounts, NotificationListResult } from "@/apis/modules/notifications"
import { logger as Logger } from "@/infrastructure/logger"
import { formatUnreadCount } from "./formatUnreadCount"
import { mapNotificationItem, toApiCategory } from "./mapNotification"
import {
	getBusinessCode,
	NOTIFICATION_ERROR_CODE,
	shouldRefreshAfterNotificationError,
} from "./notificationErrors"
import { notificationLocaleFromI18n, readTemplateCache, writeTemplateCache } from "./templateCache"
import type {
	NotificationAuthStatus,
	NotificationItemData,
	NotificationId,
	NotificationTab,
	NotificationTemplateCatalog,
} from "./types"

const logger = Logger.createLogger("NotificationCenterStore")
const PAGE_SIZE = 10
const MARK_ALL_PAGE_SIZE = 100
const MARK_ALL_MAX_PAGES = 10

export class NotificationCenterStore {
	visible = false
	activeTab: NotificationTab = "all"
	messages: NotificationItemData[] = []
	nextCursor: string | null = null
	hasMore = false
	listLoading = false
	listLoadingMore = false
	systemUnread = 0
	authorizationPending = 0
	totalUnread = 0
	catalog: NotificationTemplateCatalog | null = null
	actingIds: Record<string, true> = {}
	private listRequestId = 0
	private countsRequest: Promise<void> | null = null
	private countsRevision = 0
	private countsDirty = false
	private scopeRevision = 0
	private listRequest: Promise<void> | null = null
	private listDirty = false
	private readingIds = new Set<string>()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get unreadTotal() {
		return this.totalUnread
	}

	get unreadSystem() {
		return this.systemUnread
	}

	get unreadAuth() {
		return this.authorizationPending
	}

	get unreadTotalLabel() {
		return formatUnreadCount(this.unreadTotal)
	}

	get unreadSystemLabel() {
		return formatUnreadCount(this.unreadSystem)
	}

	get unreadAuthLabel() {
		return formatUnreadCount(this.unreadAuth)
	}

	get visibleMessages() {
		return this.messages
	}

	getTemplate(type: string, version: number) {
		return this.catalog?.templates[`${type}:${version}`] ?? null
	}

	open() {
		this.visible = true
		void this.refresh()
	}

	close() {
		this.visible = false
	}

	setActiveTab(tab: NotificationTab) {
		if (this.activeTab === tab) return Promise.resolve()
		this.activeTab = tab
		this.invalidateList()
		this.messages = []
		this.nextCursor = null
		this.hasMore = false
		if (this.visible) return this.reloadList()
		return Promise.resolve()
	}

	async refresh() {
		await Promise.all([this.loadCounts(), this.loadTemplates(), this.reloadList()])
	}

	async loadCounts() {
		this.countsDirty = true
		if (this.countsRequest) return this.countsRequest
		const scope = this.scopeRevision
		const request = this.reconcileCounts(scope).finally(() => {
			runInAction(() => {
				if (this.countsRequest === request) this.countsRequest = null
			})
		})
		this.countsRequest = request
		return this.countsRequest
	}

	private async reconcileCounts(scope: number) {
		while (this.countsDirty && scope === this.scopeRevision) {
			runInAction(() => {
				this.countsDirty = false
			})
			await this.fetchCounts()
		}
	}

	setCounts(counts: NotificationCounts) {
		// An HTTP read started before a push must not overwrite its newer counts.
		this.countsRevision += 1
		this.totalUnread = counts.total
		this.systemUnread = counts.system_unread
		this.authorizationPending = counts.authorization_pending
	}

	async reconcile() {
		await Promise.all([this.loadCounts(), this.reloadList()])
	}

	private async fetchCounts() {
		const revision = this.countsRevision
		try {
			const counts = await NotificationApi.getNotificationCounts()
			if (revision !== this.countsRevision) return
			runInAction(() => {
				this.setCounts(counts)
			})
		} catch (error) {
			logger.error({
				eventKey: "inbox_counts_failed",
				errorKind: "network",
				error,
				message: "Failed to load notification counts",
			})
		}
	}

	async loadTemplates(language = i18next.language) {
		const locale = notificationLocaleFromI18n(language)
		const cached = readTemplateCache(locale) ?? readTemplateCache("zh-CN")
		if (cached && !this.catalog) {
			runInAction(() => {
				this.catalog = cached
			})
		}

		try {
			const catalog = await NotificationApi.getNotificationTemplates(locale)
			runInAction(() => {
				this.catalog = catalog
			})
			writeTemplateCache(catalog)
		} catch (error) {
			logger.error({
				eventKey: "inbox_templates_failed",
				errorKind: "network",
				error,
				message: "Failed to load notification templates; using cache if present",
				context: { locale },
			})
			if (!this.catalog && cached) {
				runInAction(() => {
					this.catalog = cached
				})
			}
		}
	}

	async reloadList() {
		if (!this.visible) return
		this.listDirty = true
		if (this.listRequest) return this.listRequest
		const requestId = ++this.listRequestId
		this.listLoadingMore = false
		const request = this.reconcileList(requestId).finally(() => {
			runInAction(() => {
				if (this.listRequest === request) this.listRequest = null
			})
		})
		this.listRequest = request
		return request
	}

	private async reconcileList(requestId: number) {
		// Coalesce bursts, but always re-read if another push arrives during a read.
		while (this.listDirty && requestId === this.listRequestId && this.visible) {
			runInAction(() => {
				this.listDirty = false
			})
			await this.fetchListSnapshot(requestId)
		}
	}

	private async fetchListSnapshot(requestId: number) {
		this.listLoading = true
		try {
			// Re-read the loaded range so background recovery preserves pagination and scroll.
			const targetSize = Math.max(PAGE_SIZE, this.messages.length)
			let page = await this.fetchPage()
			const items = [...page.items]
			while (items.length < targetSize && page.has_more && page.next_cursor) {
				if (requestId !== this.listRequestId) return
				page = await this.fetchPage(page.next_cursor)
				items.push(...page.items)
			}
			if (requestId !== this.listRequestId) return
			runInAction(() => {
				this.messages = items
					.filter((item) => item.message_status !== "withdrawn")
					.map(mapNotificationItem)
				this.nextCursor = page.next_cursor
				this.hasMore = page.has_more
				this.listLoading = false
			})
		} catch (error) {
			if (requestId !== this.listRequestId) return
			logger.error({
				eventKey: "inbox_list_failed",
				errorKind: "network",
				error,
				message: "Failed to load notification list",
			})
			runInAction(() => {
				this.listLoading = false
			})
		}
	}

	async loadMore() {
		if (!this.visible || this.listLoading || this.listLoadingMore || !this.hasMore) return
		this.listLoadingMore = true
		const cursor = this.nextCursor
		const requestId = this.listRequestId
		try {
			const page = await this.fetchPage(cursor ?? undefined)
			if (requestId !== this.listRequestId) return
			runInAction(() => {
				const ids = new Set(this.messages.map((message) => message.id))
				this.messages = [
					...this.messages,
					...page.items
						.filter(
							(item) =>
								item.message_status !== "withdrawn" &&
								!ids.has(item.notification_id),
						)
						.map(mapNotificationItem),
				]
				this.nextCursor = page.next_cursor
				this.hasMore = page.has_more
				this.listLoadingMore = false
			})
		} catch (error) {
			if (requestId !== this.listRequestId) return
			logger.error({
				eventKey: "inbox_list_more_failed",
				errorKind: "network",
				error,
				message: "Failed to load more notifications",
			})
			runInAction(() => {
				this.listLoadingMore = false
			})
		}
	}

	async markRead(id: NotificationId) {
		const message = this.messages.find((item) => item.id === id)
		if (!message || message.category === "auth" || !message.is_unread) return
		if (this.readingIds.has(id)) return
		this.readingIds.add(id)
		const scope = this.scopeRevision
		try {
			await NotificationApi.markNotificationRead(id)
			if (scope !== this.scopeRevision) return
			runInAction(() => {
				message.is_unread = false
			})
			await this.loadCounts()
		} catch (error) {
			if (scope !== this.scopeRevision) return
			if (shouldRefreshAfterNotificationError(getBusinessCode(error))) {
				await this.refreshAfterMutation()
			}
		} finally {
			runInAction(() => {
				if (scope === this.scopeRevision) this.readingIds.delete(id)
			})
		}
	}

	async markAllSystemRead() {
		const scope = this.scopeRevision
		const ids: string[] = []
		let cursor: string | undefined
		for (let pageIndex = 0; pageIndex < MARK_ALL_MAX_PAGES; pageIndex += 1) {
			const page = await NotificationApi.listNotifications({
				category: "system",
				cursor,
				page_size: MARK_ALL_PAGE_SIZE,
			})
			if (scope !== this.scopeRevision) return
			page.items.forEach((item) => {
				if (item.read_status === "unread") ids.push(item.notification_id)
			})
			if (!page.has_more || !page.next_cursor) break
			cursor = page.next_cursor
		}
		await Promise.all(
			ids.map((id) => NotificationApi.markNotificationRead(id).catch(() => undefined)),
		)
		if (scope !== this.scopeRevision) return
		// Async API completions must publish observable changes inside a MobX action.
		runInAction(() => {
			this.messages.forEach((message) => {
				if (message.category === "system") message.is_unread = false
			})
		})
		await this.refreshAfterMutation()
	}

	async respondAuth(id: NotificationId, status: Exclude<NotificationAuthStatus, "pending">) {
		const scope = this.scopeRevision
		const message = this.messages.find((item) => item.id === id)
		if (!message || message.category !== "auth" || message.auth_status !== "pending") return
		if (this.actingIds[id]) return

		this.actingIds = { ...this.actingIds, [id]: true }
		try {
			if (status === "accepted") {
				const result = await NotificationApi.acceptNotification(id)
				if (scope !== this.scopeRevision) return
				runInAction(() => {
					message.auth_status = "accepted"
					message.business_result = result.business_result
					message.is_unread = false
				})
			} else {
				await NotificationApi.rejectNotification(id)
				if (scope !== this.scopeRevision) return
				runInAction(() => {
					message.auth_status = "rejected"
					message.is_unread = false
				})
			}
			await this.loadCounts()
			return { ok: true as const, expired: message.business_result === "expired" }
		} catch (error) {
			if (scope !== this.scopeRevision) return
			const code = getBusinessCode(error)
			if (code === NOTIFICATION_ERROR_CODE.EXPIRED) {
				runInAction(() => {
					message.auth_status = status
					message.business_result = "expired"
					message.is_unread = false
				})
				await this.refreshAfterMutation()
				return { ok: true as const, expired: true }
			}
			if (shouldRefreshAfterNotificationError(code)) {
				await this.refreshAfterMutation()
				return { ok: false as const, withdrawn: code === NOTIFICATION_ERROR_CODE.WITHDRAWN }
			}
			return { ok: false as const }
		} finally {
			runInAction(() => {
				if (scope !== this.scopeRevision) return
				const { [id]: _removed, ...rest } = this.actingIds
				this.actingIds = rest
			})
		}
	}

	clearUserCache() {
		this.scopeRevision += 1
		this.countsRevision += 1
		this.countsRequest = null
		this.countsDirty = false
		this.messages = []
		this.nextCursor = null
		this.hasMore = false
		this.systemUnread = 0
		this.authorizationPending = 0
		this.totalUnread = 0
		this.actingIds = {}
		this.readingIds.clear()
		this.invalidateList()
	}

	private invalidateList() {
		this.listRequestId += 1
		this.listRequest = null
		this.listDirty = false
		this.listLoading = false
		this.listLoadingMore = false
	}

	reset() {
		this.visible = false
		this.activeTab = "all"
		this.listLoading = false
		this.listLoadingMore = false
		this.catalog = null
		this.clearUserCache()
	}

	private async refreshAfterMutation() {
		await Promise.all([this.loadCounts(), this.visible ? this.reloadList() : Promise.resolve()])
	}

	private fetchPage(cursor?: string): Promise<NotificationListResult> {
		return NotificationApi.listNotifications({
			category: toApiCategory(this.activeTab),
			cursor,
			page_size: PAGE_SIZE,
		})
	}
}

export const notificationCenterStore = new NotificationCenterStore()

export function openNotificationCenter() {
	notificationCenterStore.open()
}

export function clearNotificationCenterUserCache() {
	notificationCenterStore.clearUserCache()
}
