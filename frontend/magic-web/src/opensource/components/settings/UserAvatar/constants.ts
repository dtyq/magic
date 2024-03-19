import { AvatarUploadConfig } from "./types"

export const DEFAULT_AVATAR_UPLOAD_CONFIG: AvatarUploadConfig = {
	maxFileSize: 2 * 1024 * 1024, // 2MB
	compressionQuality: 0.6,
	acceptedFileTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
	storageType: "public",
}

export const UPLOAD_ERROR_MESSAGES = {
	FILE_TOO_LARGE: "setting.uploadAvatar.fileTooLarge",
	INVALID_FILE_TYPE: "setting.uploadAvatar.invalidFileType",
	NO_FILE_SELECTED: "setting.uploadAvatar.noFileSelected",
	NETWORK_ERROR: "setting.uploadAvatar.networkError",
	PERMISSION_ERROR: "setting.uploadAvatar.permissionError",
	UPLOAD_FAILED: "setting.uploadAvatar.failed",
	SUCCESS: "setting.uploadAvatar.success",
} as const

export const UI_CONSTANTS = {
	DEFAULT_AVATAR_SIZE: 40,
	UPLOAD_TRANSITION_DURATION: "0.3s",
} as const
