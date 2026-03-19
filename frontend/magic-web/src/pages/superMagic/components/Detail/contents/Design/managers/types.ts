import type { DesignData } from "../types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"

export interface DesignProjectManagerOptions {
	currentFile?: { id: string; name: string }
	attachments?: FileItem[]
	flatAttachments?: FileItem[]
	projectId?: string
	allowEdit: boolean
	isPlaybackMode: boolean
	isShareRoute: boolean
	isMobile: boolean
	designProjectId?: string
	designProjectName?: string
	selectedTopicId?: string | null
	onRemoteDesignDataUpdate?: (
		oldDesignData: DesignData,
		newDesignData: DesignData,
		updateType: "message" | "revoke" | "restore",
	) => void
	updateListenerDebounceMs?: number
	onVersionChange?: (designData: DesignData, isViewingHistory: boolean) => void
	/** i18n 翻译函数，用于 toasts 等 */
	getT?: () => (key: string) => string
}

export interface DesignProjectStateBagSetters {
	setMagicProjectJsFileId: (v: string | null) => void
	setDesignData: (data: DesignData) => void
	setIsInitialLoading: (v: boolean) => void
	setIsSaving: (v: boolean) => void
	setIsReadOnly: (v: boolean) => void
	setFileVersionsList: (v: FileHistoryVersion[]) => void
	setFileVersion: (v: number | undefined) => void
	setIsProcessingRevoke: (v: boolean) => void
	setRevokeType: (v: "revoke" | "restore" | null) => void
}

export interface DesignProjectStateBag {
	getDesignData: () => DesignData
	getMagicProjectJsFileId: () => string | null
	getMagicProjectJsVersion: () => number | null
	setMagicProjectJsVersion: (v: number | null) => void
	getPrevDesignDataStr: () => string
	setPrevDesignDataStr: (v: string) => void
	getIsReadOnly: () => boolean
	setters: DesignProjectStateBagSetters
}

export function getDataToCompare(data: DesignData) {
	return {
		type: data.type,
		name: data.name,
		version: data.version,
		canvas: { elements: data.canvas?.elements || [] },
	}
}
