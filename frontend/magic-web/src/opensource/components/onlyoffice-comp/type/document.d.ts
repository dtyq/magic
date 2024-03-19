// OnlyOffice 编辑器类型定义
interface DocEditorConfig {
	document: {
		title: string
		url: string
		fileType: string
		permissions: {
			edit: boolean
			chat: boolean
			protect: boolean
		}
	}
	editorConfig: {
		lang: string
		customization: {
			help: boolean
			about: boolean
			hideRightMenu: boolean
			features: {
				spellcheck: {
					change: boolean
				}
			}
			anonymous: {
				request: boolean
				label: string
			}
		}
	}
	events: {
		onAppReady: () => void
		onDocumentReady: () => void
		onSave: (event: SaveEvent) => void
		onDownloadAs?: (event: { data: { fileType: string; url: string } }) => void
		onRequestSaveAs?: (event: {
			data: { fileType: string; title: string; url: string }
		}) => void
	}
}

interface SaveEvent {
	data: {
		data: {
			data: ArrayBuffer
		}
		option: {
			outputformat: number
		}
	}
}

interface WriteFileEvent {
	data: {
		data: Uint8Array
		file: string
		target: {
			frameOrigin: string
		}
	}
	callback?: (result: { success: boolean; error?: string }) => void
}

interface DocEditor {
	sendCommand: (params: {
		command: string
		data: {
			err_code?: number
			urls?: Record<string, string>
			path?: string
			imgName?: string
			buf?: ArrayBuffer
			success?: boolean
			error?: string
		}
	}) => void
	destroyEditor: () => void
}

interface DocsAPI {
	DocEditor: new (elementId: string, config: DocEditorConfig) => DocEditor
}

declare global {
	interface Window {
		DocsAPI: DocsAPI
		Module: EmscriptenModule
	}
}
