export interface AvatarUploadConfig {
	maxFileSize: number
	compressionQuality: number
	acceptedFileTypes: string[]
	storageType: "public" | "private"
}

export interface UserPermission {
	permission: boolean
}

export interface FileUploadResult {
	key: string
	size: number
	name: string
	url?: string
}

export interface AvatarUploadError extends Error {
	code?: string
	type?: "validation" | "network" | "permission" | "upload" | "unknown"
}
