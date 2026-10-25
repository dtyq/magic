import { makeAutoObservable, runInAction } from "mobx"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import type { AICardEntry, AICardHistoryEntry, AICardProjectConfig, AICardViewMode } from "../types"
import { buildAICardSyncFingerprint } from "../utils/aiCardSyncFingerprint"

function parseAICardProjectConfig(content: string): AICardProjectConfig | null {
	const config = parseMagicProjectConfigContent(content)
	if (!config || config.type !== "ai-card") return null
	return config as unknown as AICardProjectConfig
}

export class AICardStore {
	cards: AICardEntry[] = []
	viewMode: AICardViewMode = "dashboard"
	activeCardId: string | null = null
	/** When viewing a history entry, this holds the history file id */
	activeHistoryFileId: string | null = null
	historyEntries: AICardHistoryEntry[] = []
	loading = true
	error: string | null = null
	projectConfig: AICardProjectConfig | null = null

	private folderFileId: string | undefined
	private attachmentList: any[] | undefined
	private lastSyncFingerprint = ""
	private hasSynced = false
	/**
	 * File client bound to the ambient FileAccessProvider identity, injected by the
	 * React boundary (`index.tsx`) so the share preview's magic.project.js read
	 * carries its share `access`. A store built without one (bare test construction)
	 * falls back to the unbound leaf. Immutable dependency, so not observable.
	 */
	private readonly fileApi?: FileApi

	constructor(fileApi?: FileApi) {
		this.fileApi = fileApi
		makeAutoObservable(this, { fileApi: false })
	}

	get activeCard(): AICardEntry | null {
		if (!this.activeCardId) return null
		return this.cards.find((c) => c.id === this.activeCardId) || null
	}

	/** The file ID to render in the detail iframe */
	get detailFileId(): string | undefined {
		return this.activeHistoryFileId || this.activeCard?.latestHtmlFileId
	}

	get detailVersionFileIds(): string[] {
		const latestHtmlFileId = this.activeCard?.latestHtmlFileId
		const fileIds: string[] = []
		const seen = new Set<string>()

		if (latestHtmlFileId) {
			fileIds.push(latestHtmlFileId)
			seen.add(latestHtmlFileId)
		}

		for (const entry of this.historyEntries) {
			if (!entry.fileId || seen.has(entry.fileId)) continue
			fileIds.push(entry.fileId)
			seen.add(entry.fileId)
		}

		return fileIds
	}

	get detailVersionCount(): number {
		return this.detailVersionFileIds.length
	}

	get detailVersionIndex(): number {
		const fileId = this.detailFileId
		if (!fileId) return -1
		return this.detailVersionFileIds.indexOf(fileId)
	}

	get canOpenPreviousDetailVersion(): boolean {
		return this.detailVersionIndex > 0
	}

	get canOpenNextDetailVersion(): boolean {
		const index = this.detailVersionIndex
		return index >= 0 && index < this.detailVersionFileIds.length - 1
	}

	get hasConfig(): boolean {
		return !!this.projectConfig?.schedule_id
	}

	/** The file_id of magic.project.js (if found) */
	get configFileId(): string | undefined {
		const children = this.findChildren()
		const configFile = children.find(
			(f: any) => f.file_name === "magic.project.js" && !f.is_directory,
		)
		return configFile?.file_id?.toString()
	}

	setViewMode(mode: AICardViewMode) {
		this.viewMode = mode
	}

	openCardDetail(cardId: string) {
		this.activeCardId = cardId
		this.activeHistoryFileId = null
		this.viewMode = "detail"
	}

	openHistoryDetail(historyFileId: string) {
		// Use the main card as context, but show history file
		if (this.cards.length > 0) {
			this.activeCardId = this.cards[0].id
		}
		this.activeHistoryFileId = historyFileId
		this.viewMode = "detail"
	}

	openPreviousDetailVersion() {
		this.openDetailVersionByOffset(-1)
	}

	openNextDetailVersion() {
		this.openDetailVersionByOffset(1)
	}

	goBack() {
		this.viewMode = "dashboard"
		this.activeCardId = null
		this.activeHistoryFileId = null
	}

	async sync(folderFileId?: string, attachmentList?: any[]) {
		this.folderFileId = folderFileId
		this.attachmentList = attachmentList
		const nextFingerprint = buildAICardSyncFingerprint(folderFileId, this.findChildren())
		if (this.hasSynced && nextFingerprint === this.lastSyncFingerprint) return
		this.lastSyncFingerprint = nextFingerprint
		this.hasSynced = true
		await this.loadCards()
	}

	private async loadCards() {
		runInAction(() => {
			this.loading = true
			this.error = null
		})

		try {
			const children = this.findChildren()
			if (!children.length) {
				runInAction(() => {
					this.cards = []
					this.loading = false
				})
				return
			}

			// Find magic.project.js to get config
			const configFile = children.find(
				(f: any) => f.file_name === "magic.project.js" && !f.is_directory,
			)

			let projectConfig: AICardProjectConfig | null = null
			if (configFile?.file_id) {
				projectConfig = await this.fetchProjectConfig(configFile.file_id)
			}

			runInAction(() => {
				this.projectConfig = projectConfig
			})

			// Find latest: prefer folder-based (latest/index.html), fallback to legacy (latest.html)
			const latestFile = this.resolveEntryFile(children, "latest")

			// Find template: prefer folder-based (template/index.html), fallback to legacy (template.html)
			const templateName = projectConfig?.template || "template"
			const templateFile = this.resolveEntryFile(children, templateName)

			// Build card entry
			const card: AICardEntry = {
				id: this.folderFileId || "default",
				name: projectConfig?.name || "AI Card",
				description: projectConfig?.description || "",
				fileId: this.folderFileId,
				latestHtmlFileId: latestFile?.file_id,
				templateFileId: templateFile?.file_id,
				lastUpdated: projectConfig?.last_generated || latestFile?.updated_at,
				status: projectConfig?.status || "active",
			}

			runInAction(() => {
				this.cards = [card]
				this.historyEntries = this.buildHistoryEntries(children)
				this.loading = false
			})
		} catch (err) {
			runInAction(() => {
				this.error = err instanceof Error ? err.message : "Failed to load AI Card"
				this.loading = false
			})
		}
	}

	private buildHistoryEntries(children: any[]): AICardHistoryEntry[] {
		const historyDir = children.find((f: any) => f.file_name === "history" && f.is_directory)
		if (!historyDir?.children?.length) {
			return []
		}

		const entries: AICardHistoryEntry[] = []

		for (const f of historyDir.children) {
			const name = f.file_name || ""

			if (!f.is_directory && name.endsWith(".html")) {
				// Legacy: history/YYYY-MM-DD_HH-mm.html
				const match = name.match(/(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})\.html$/)
				const timestamp = match ? `${match[1]}T${match[2]}:${match[3]}:00` : ""
				entries.push({
					fileId: f.file_id,
					fileName: name,
					timestamp,
					displayTime: match ? `${match[1]} ${match[2]}:${match[3]}` : name,
				})
			} else if (f.is_directory && f.children?.length) {
				// Folder-based: history/YYYY-MM-DD_HH-mm/index.html
				const indexFile = f.children.find(
					(c: any) => c.file_name === "index.html" && !c.is_directory,
				)
				if (indexFile) {
					const match = name.match(/(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})$/)
					const timestamp = match ? `${match[1]}T${match[2]}:${match[3]}:00` : ""
					entries.push({
						fileId: indexFile.file_id,
						fileName: `${name}/index.html`,
						timestamp,
						displayTime: match ? `${match[1]} ${match[2]}:${match[3]}` : name,
					})
				}
			}
		}

		return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
	}

	/**
	 * Resolve an entry file supporting both folder-based and legacy single-file structures.
	 * For a given name (e.g. "latest"):
	 *   - Folder-based: looks for directory "latest" containing "index.html"
	 *   - Legacy single-file: looks for "latest.html"
	 */
	private resolveEntryFile(children: any[], name: string): any | undefined {
		// Folder-based: name/ directory with index.html
		const folder = children.find((f: any) => f.file_name === name && f.is_directory)
		if (folder?.children?.length) {
			const indexFile = folder.children.find(
				(c: any) => c.file_name === "index.html" && !c.is_directory,
			)
			if (indexFile) return indexFile
		}

		// Legacy: name.html single file
		const htmlName = name.endsWith(".html") ? name : `${name}.html`
		return children.find((f: any) => f.file_name === htmlName && !f.is_directory)
	}

	private findChildren(): any[] {
		if (!this.attachmentList?.length) return []

		// The folder itself may be in attachmentList
		const folder = this.attachmentList.find((f: any) => f.file_id === this.folderFileId)
		if (folder?.children?.length) return folder.children

		// Or the attachmentList IS the children
		return this.attachmentList
	}

	private openDetailVersionByOffset(offset: number) {
		const currentIndex = this.detailVersionIndex
		if (currentIndex < 0) return

		const nextFileId = this.detailVersionFileIds[currentIndex + offset]
		if (!nextFileId) return

		this.activeHistoryFileId =
			nextFileId === this.activeCard?.latestHtmlFileId ? null : nextFileId
		this.viewMode = "detail"
	}

	private async fetchProjectConfig(fileId: string): Promise<AICardProjectConfig | null> {
		try {
			// Production always injects an access-bound FileApi; the direct leaf import is
			// the unbound fallback for `new AICardStore()` without a file client (tests).
			const getUrls = this.fileApi
				? this.fileApi.getTemporaryDownloadUrl
				: getTemporaryDownloadUrl
			const urls = await getUrls({ file_ids: [fileId] })
			const url = urls?.[0]?.url
			if (!url) return null
			const resp = await fetch(url, { credentials: "omit" })
			if (!resp.ok) return null
			const text = await resp.text()
			return parseAICardProjectConfig(text)
		} catch {
			return null
		}
	}
}
