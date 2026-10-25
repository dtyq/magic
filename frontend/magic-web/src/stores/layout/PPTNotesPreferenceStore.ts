import { makeAutoObservable } from "mobx"

const STORAGE_KEY = "supermagic-ppt-notes-visible"
const FONT_STORAGE_KEY = "supermagic-ppt-notes-font-size"
const AUTO_APPLY_STORAGE_KEY = "supermagic-ppt-notes-auto-apply"
const HEIGHT_STORAGE_KEY = "supermagic-ppt-notes-height"
const MODEL_STORAGE_KEY = "supermagic-ppt-notes-model"
const MODEL_HINT_STORAGE_KEY = "supermagic-ppt-notes-model-hint-dismissed"

/** One browser-wide preference, shared by every PPT rather than stored per file. */
export class PPTNotesPreferenceStore {
	/** Empty means "use the default available model". */
	modelId = ""
	visible = false
	height = 144
	fontSize = 13
	autoApply = true
	modelHintDismissed = false

	constructor() {
		try {
			const fontSize = Number(localStorage.getItem(FONT_STORAGE_KEY))
			if (Number.isInteger(fontSize) && fontSize >= 11 && fontSize <= 31)
				this.fontSize = fontSize
			this.autoApply = localStorage.getItem(AUTO_APPLY_STORAGE_KEY) !== "false"
			this.visible = localStorage.getItem(STORAGE_KEY) === "true"
			this.modelId = localStorage.getItem(MODEL_STORAGE_KEY) ?? ""
			this.modelHintDismissed = localStorage.getItem(MODEL_HINT_STORAGE_KEY) === "true"
			const height = Number(localStorage.getItem(HEIGHT_STORAGE_KEY))
			if (Number.isFinite(height) && height >= 100) this.height = height
		} catch {
			// Storage restrictions must not prevent opening a presentation.
		}
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setFontSize(size: number) {
		if (!Number.isInteger(size) || size < 11 || size > 31) return
		this.fontSize = size
		try {
			localStorage.setItem(FONT_STORAGE_KEY, String(size))
		} catch {
			// Reading controls remain usable when storage is restricted.
		}
	}

	setModelId(modelId: string) {
		this.modelId = modelId
		try {
			localStorage.setItem(MODEL_STORAGE_KEY, modelId)
		} catch {
			// The current session still keeps the user's choice.
		}
	}

	dismissModelHint() {
		this.modelHintDismissed = true
		try {
			localStorage.setItem(MODEL_HINT_STORAGE_KEY, "true")
		} catch {
			// The hint may reappear next time; it never blocks the feature.
		}
	}

	setAutoApply(value: boolean) {
		this.autoApply = value
		try {
			localStorage.setItem(AUTO_APPLY_STORAGE_KEY, String(value))
		} catch {
			// The current session still keeps the user's choice.
		}
	}

	setHeight(height: number) {
		if (!Number.isFinite(height) || height < 100) return
		this.height = height
		try {
			localStorage.setItem(HEIGHT_STORAGE_KEY, String(height))
		} catch {
			// Resizing remains available when browser storage is restricted.
		}
	}

	setVisible(visible: boolean) {
		this.visible = visible
		try {
			localStorage.setItem(STORAGE_KEY, String(visible))
		} catch {
			// Keep the preference usable in memory when storage is unavailable.
		}
	}

	toggle() {
		this.setVisible(!this.visible)
	}
}

export const pptNotesPreferenceStore = new PPTNotesPreferenceStore()
