import { makeAutoObservable } from "mobx"

export interface PanelConfig {
	storageKey: string
	defaultWidth: number
	minWidth: number
	maxWidth: number
}

export class ResizablePanelStore {
	// Container width for percentage calculations
	containerWidth: number = 0

	// Store panel sizes in percentage (Map<storageKey, percentage>)
	// Using plain Map (non-observable) to avoid triggering re-renders during drag
	// Changed from pixels to percentage to avoid dependency on containerWidth
	panelSizes: Map<string, number> = new Map()

	// Pending save timeouts (Map<storageKey, timeoutId>)
	private saveTimeouts: Map<string, number> = new Map()

	// Debounce delay for localStorage save (only save when dragging stops)
	private readonly SAVE_DELAY = 300

	constructor() {
		makeAutoObservable(
			this,
			{
				// Mark panelSizes as non-observable to prevent unnecessary re-renders
				// Private fields (lastUpdateTime, saveTimeouts) are automatically excluded
				panelSizes: false,
			},
			{ autoBind: true },
		)
	}

	// Set container width (called when container resizes)
	setContainerWidth = (width: number) => {
		this.containerWidth = width
	}

	// Get panel size as percentage
	getPanelSize = (config: PanelConfig): number => {
		// Try to get from memory first
		let percentage = this.panelSizes.get(config.storageKey)

		// If not in memory, try to load from localStorage
		if (percentage === undefined) {
			const savedPercentage = this.loadFromStorage(config.storageKey)
			if (savedPercentage !== null) {
				percentage = savedPercentage
				this.panelSizes.set(config.storageKey, percentage)
			}
		}

		// Return cached percentage or default
		return percentage !== undefined && percentage !== null
			? percentage
			: this.calculateDefaultPercent(config.defaultWidth)
	}

	// Update panel size in memory immediately and schedule localStorage save
	// This method is optimized for zero-latency during drag operations
	updatePanelSize = (storageKey: string, percentage: number) => {
		// Update memory cache immediately without any throttle
		// panelSizes is non-observable to prevent triggering React re-renders
		this.panelSizes.set(storageKey, percentage)

		// Schedule deferred save to localStorage
		// Only persists after user stops dragging (debounced)
		this.scheduleDelayedSave(storageKey, percentage)
	}

	// Schedule delayed save to localStorage
	private scheduleDelayedSave = (storageKey: string, percentage: number) => {
		// Clear existing timeout
		const existingTimeout = this.saveTimeouts.get(storageKey)
		if (existingTimeout !== undefined) {
			clearTimeout(existingTimeout)
		}

		// Schedule save after dragging stops
		const timeoutId = window.setTimeout(() => {
			this.saveToStorage(storageKey, percentage)
			this.saveTimeouts.delete(storageKey)
		}, this.SAVE_DELAY)

		this.saveTimeouts.set(storageKey, timeoutId)
	}

	// Persist panel size immediately to localStorage
	persistPanelSize = (storageKey: string) => {
		// Clear any pending timeout
		const timeout = this.saveTimeouts.get(storageKey)
		if (timeout !== undefined) {
			clearTimeout(timeout)
			this.saveTimeouts.delete(storageKey)
		}

		// Save immediately
		const percentage = this.panelSizes.get(storageKey)
		if (percentage !== undefined) {
			this.saveToStorage(storageKey, percentage)
		}
	}

	// Get minimum size as percentage
	getMinSize = (minWidth: number): number => {
		if (!this.containerWidth) return 10
		return (minWidth / this.containerWidth) * 100
	}

	// Get maximum size as percentage
	getMaxSize = (maxWidth: number): number => {
		if (!this.containerWidth) return 50
		return (maxWidth / this.containerWidth) * 100
	}

	// Get default size as percentage
	getDefaultSize = (defaultWidth: number): number => {
		return this.calculateDefaultPercent(defaultWidth)
	}

	// Private: Calculate default percentage
	private calculateDefaultPercent = (pixelWidth: number): number => {
		if (!this.containerWidth) return 33.33
		return (pixelWidth / this.containerWidth) * 100
	}

	// Private: Load from localStorage
	private loadFromStorage = (storageKey: string): number | null => {
		try {
			const saved = localStorage.getItem(storageKey)
			if (saved) {
				const value = parseFloat(saved)
				// Check if it's a valid percentage (between 0 and 100)
				if (!isNaN(value) && value > 0 && value <= 100) {
					return value
				}
				// Legacy support: if value > 100, assume it's pixels from old implementation
				// Try to convert to percentage if containerWidth is available
				if (!isNaN(value) && value > 100 && this.containerWidth > 0) {
					const percentage = (value / this.containerWidth) * 100
					// Ensure the converted percentage is reasonable (< 100%)
					if (percentage > 0 && percentage <= 100) {
						// Save the converted percentage back to localStorage
						this.saveToStorage(storageKey, percentage)
						return percentage
					}
				}
			}
		} catch (error) {
			console.error(`Failed to load panel size from localStorage (${storageKey}):`, error)
		}
		return null
	}

	// Private: Save to localStorage
	private saveToStorage = (storageKey: string, percentage: number) => {
		try {
			// Round to 2 decimal places for cleaner storage
			const rounded = Math.round(percentage * 100) / 100
			localStorage.setItem(storageKey, rounded.toString())
		} catch (error) {
			console.error(`Failed to save panel size to localStorage (${storageKey}):`, error)
		}
	}

	// Clear specific panel size
	clearPanelSize = (storageKey: string) => {
		// Clear pending timeout
		const timeout = this.saveTimeouts.get(storageKey)
		if (timeout !== undefined) {
			clearTimeout(timeout)
			this.saveTimeouts.delete(storageKey)
		}

		// Clear from memory and storage
		this.panelSizes.delete(storageKey)
		try {
			localStorage.removeItem(storageKey)
		} catch (error) {
			console.error(`Failed to remove panel size from localStorage (${storageKey}):`, error)
		}
	}

	// Reset all panel sizes
	resetAllPanels = () => {
		// Clear all pending timeouts
		this.saveTimeouts.forEach((timeout) => {
			clearTimeout(timeout)
		})
		this.saveTimeouts.clear()

		// Clear from memory and storage
		this.panelSizes.forEach((_, key) => {
			try {
				localStorage.removeItem(key)
			} catch (error) {
				console.error(`Failed to remove panel size from localStorage (${key}):`, error)
			}
		})
		this.panelSizes.clear()
	}
}

export const resizablePanelStore = new ResizablePanelStore()
