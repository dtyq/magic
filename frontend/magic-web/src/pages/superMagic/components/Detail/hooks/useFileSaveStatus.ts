import { useSyncExternalStore } from "react"
import {
	FILE_SAVE_STATUS,
	getFileSaveQueue,
	type FileSaveSnapshot,
	type FileSaveStatus,
} from "../services/fileSaveQueue"

export function useFileSaveStatus(fileId?: string): FileSaveStatus {
	const queue = getFileSaveQueue()
	useSyncExternalStore(queue.subscribe, queue.getRevision, queue.getRevision)
	return queue.getStatus(fileId)
}

export function useFileSaveSnapshot(fileId?: string): FileSaveSnapshot | undefined {
	const queue = getFileSaveQueue()
	useSyncExternalStore(queue.subscribe, queue.getRevision, queue.getRevision)
	return fileId ? queue.getSnapshot(fileId) : undefined
}

export function useHasUnsyncedFileSaves(): boolean {
	const queue = getFileSaveQueue()
	useSyncExternalStore(queue.subscribe, queue.getRevision, queue.getRevision)
	return queue.hasUnsynced()
}

export function isFileSaveUnsynced(status: FileSaveStatus): boolean {
	return status !== FILE_SAVE_STATUS.Idle
}
