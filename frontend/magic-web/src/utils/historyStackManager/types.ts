/**
 * TypeScript type definitions for HistoryStackManager
 */

export interface VirtualEntry {
	id: string
	timestamp: number
	component: string
	cleanup?: () => void
}

export interface HistoryStackStats {
	totalEntries: number
	entriesByComponent: Record<string, number>
}

export interface HistoryStackContextValue {
	manager: HistoryStackManagerInterface
	getStats: () => HistoryStackStats
	getActiveStack: () => string[]
	hasActiveEntries: () => boolean
}

export interface HistoryStackProviderProps {
	children: React.ReactNode
	enableDebugLogging?: boolean
}

export interface UseBackHandlerReturn {
	cleanup: () => void
	getStats: () => HistoryStackStats
	getActiveStack: () => string[]
	isActive: boolean
	entryId?: string
}

export interface HistoryStackManagerInterface {
	addVirtualEntry(component: string, onBack: () => void): string
	removeVirtualEntry(entryId: string): boolean
	cleanupComponentEntries(component: string): void
	getStats(): HistoryStackStats
	cleanupStaleEntries(): void
	getActiveStack(): string[]
	hasActiveEntries(): boolean
}
