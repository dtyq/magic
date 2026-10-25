/**
 * 媒体编辑恢复意图。
 *
 * generate 用于普通生成/失败重试编辑器；quick-edit 与 re-edit 用于成片后的
 * 两个二次编辑入口。三者必须隔离，避免普通生成草稿污染二次编辑会话。
 */
export type MediaEditIntent = "generate" | "quick-edit" | "re-edit"

export interface MediaEditRecoveryKey {
	elementId: string
	contentId: string
	intent: MediaEditIntent
}

export function buildMediaEditSourceFingerprint(contentId: string, source?: string): string {
	return `${contentId}:${source ?? ""}`
}

export interface MediaEditRecoveryRecord<T = unknown> {
	baseline: T
	draft: T
	sourceFingerprint: string
	updatedAt: number
}

function getRecoveryKey(key: MediaEditRecoveryKey): string {
	return `${key.elementId}:${key.contentId}:${key.intent}`
}

export function areMediaEditSnapshotsEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Canvas 生命周期内的媒体编辑恢复管理器。
 *
 * 这是媒体编辑草稿的唯一内存来源：不写入 DSL、rootStorage 或 localStorage。
 */
export class MediaEditRecoveryManager {
	private readonly records = new Map<string, MediaEditRecoveryRecord>()

	public get<T>(
		key: MediaEditRecoveryKey,
		sourceFingerprint: string,
	): MediaEditRecoveryRecord<T> | null {
		const record = this.records.get(getRecoveryKey(key)) as
			MediaEditRecoveryRecord<T> | undefined
		if (!record || record.sourceFingerprint !== sourceFingerprint) {
			if (record) this.records.delete(getRecoveryKey(key))
			return null
		}
		return record
	}

	public set<T>(
		key: MediaEditRecoveryKey,
		sourceFingerprint: string,
		baseline: T,
		draft: T = baseline,
	): void {
		this.records.set(getRecoveryKey(key), {
			baseline,
			draft,
			sourceFingerprint,
			updatedAt: Date.now(),
		})
	}

	public updateDraft<T>(key: MediaEditRecoveryKey, sourceFingerprint: string, draft: T): void {
		const recordKey = getRecoveryKey(key)
		const current = this.records.get(recordKey) as MediaEditRecoveryRecord<T> | undefined
		if (!current || current.sourceFingerprint !== sourceFingerprint) return
		this.records.set(recordKey, {
			...current,
			draft,
			updatedAt: Date.now(),
		})
	}

	/** 首次保存时以当前草稿建立 baseline，适用于普通生成与失败重试入口。 */
	public saveDraft<T>(key: MediaEditRecoveryKey, sourceFingerprint: string, draft: T): void {
		const current = this.get<T>(key, sourceFingerprint)
		if (current) {
			this.updateDraft(key, sourceFingerprint, draft)
			return
		}
		this.set(key, sourceFingerprint, draft, draft)
	}

	/** 将 draft 恢复到 baseline，并保留该会话。 */
	public reset<T>(key: MediaEditRecoveryKey, sourceFingerprint: string): T | null {
		const current = this.get<T>(key, sourceFingerprint)
		if (!current) return null
		this.set(key, sourceFingerprint, current.baseline, current.baseline)
		return current.baseline
	}

	public clear(key: MediaEditRecoveryKey): void {
		this.records.delete(getRecoveryKey(key))
	}

	public clearContent(elementId: string, contentId: string): void {
		const prefix = `${elementId}:${contentId}:`
		for (const key of this.records.keys()) {
			if (key.startsWith(prefix)) this.records.delete(key)
		}
	}

	public clearElement(elementId: string): void {
		for (const key of this.records.keys()) {
			if (key.startsWith(`${elementId}:`)) this.records.delete(key)
		}
	}

	public clearAll(): void {
		this.records.clear()
	}
}
