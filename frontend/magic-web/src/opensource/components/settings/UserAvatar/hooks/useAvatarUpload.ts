import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { FileApi, MagicUserApi } from "@/opensource/apis"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { genFileData } from "@/opensource/pages/vectorKnowledge/utils"
import { getFileNameExtension } from "@/opensource/utils/file"
import { service } from "@/opensource/services"
import type { UserService } from "@/opensource/services/user/UserService"
import { compressionFile } from "../utils"
import { DEFAULT_AVATAR_UPLOAD_CONFIG, UPLOAD_ERROR_MESSAGES } from "../constants"
import { AvatarUploadConfig } from "../types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export enum UploadStatus {
	IDLE = "idle",
	UPLOADING = "uploading",
	SUCCESS = "success",
	ERROR = "error",
}

interface UseAvatarUploadReturn {
	uploadStatus: UploadStatus
	uploadedAvatarUrl: string
	uploadAvatar: (fileList: FileList | File[]) => Promise<void>
	isUploading: boolean
}

interface UseAvatarUploadOptions {
	config?: Partial<AvatarUploadConfig>
	autoSave?: boolean
}

export function useAvatarUpload(
	options: UseAvatarUploadOptions = {},
	autoSave = true,
): UseAvatarUploadReturn {
	const { t } = useTranslation("interface")
	const [uploadStatus, setUploadStatus] = useState<UploadStatus>(UploadStatus.IDLE)
	const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>("")

	const config = useMemo(
		() => ({ ...DEFAULT_AVATAR_UPLOAD_CONFIG, ...options.config }),
		[options.config],
	)

	const { upload, reportFiles } = useUpload({
		storageType: config.storageType,
	})

	/**
	 * @description 验证文件
	 */
	const validateFile = useCallback(
		(file: File): string | null => {
			if (!config.acceptedFileTypes.includes(file.type)) {
				return t(UPLOAD_ERROR_MESSAGES.INVALID_FILE_TYPE)
			}

			if (file.size > config.maxFileSize) {
				return t(UPLOAD_ERROR_MESSAGES.FILE_TOO_LARGE)
			}

			return null
		},
		[t, config],
	)

	/**
	 * @description 压缩文件
	 */
	const compressFileIfNeeded = useCallback(
		async (file: File): Promise<File> => {
			try {
				return await compressionFile(file, file.type, config.compressionQuality)
			} catch (error) {
				console.warn("File compression failed, using original file:", error)
				return file
			}
		},
		[config.compressionQuality],
	)

	/**
	 * @description 上传文件到服务器
	 */
	const uploadFileToServer = useCallback(
		async (file: File): Promise<string> => {
			const res = await upload([genFileData(file)])

			const fileUrls = await reportFiles(
				res.fullfilled.map((item) => ({
					file_key: item.value.key,
					file_size: item.value.size,
					file_name: item.value.name,
					file_extension: getFileNameExtension(file.name),
				})),
			)

			const fileKey = fileUrls[0].file_key
			const { url } = await FileApi.getFileUrl(fileKey)

			return url
		},
		[upload, reportFiles],
	)

	/**
	 * @description 更新用户头像
	 */
	const updateUserAvatar = useCallback(async (avatarUrl: string): Promise<void> => {
		await MagicUserApi.updateUserInfo({ avatar_url: avatarUrl })
		service.get<UserService>("userService").refreshUserInfo()
	}, [])

	/**
	 * @description 上传头像
	 */
	const uploadAvatar = useCallback(
		async (fileList: FileList | File[]): Promise<void> => {
			const file = fileList[0]

			if (!file) {
				magicToast.error(t(UPLOAD_ERROR_MESSAGES.NO_FILE_SELECTED))
				return
			}

			// 验证文件
			const validationError = validateFile(file)
			if (validationError) {
				magicToast.error(validationError)
				return
			}

			setUploadStatus(UploadStatus.UPLOADING)

			try {
				// 压缩文件
				const compressedFile = await compressFileIfNeeded(file)

				// 上传文件
				const avatarUrl = await uploadFileToServer(compressedFile)

				if (autoSave) {
					// 更新用户信息
					await updateUserAvatar(avatarUrl)
				} else {
					setUploadedAvatarUrl(avatarUrl)
				}
				setUploadStatus(UploadStatus.SUCCESS)
				magicToast.success(t(UPLOAD_ERROR_MESSAGES.SUCCESS))
			} catch (error) {
				setUploadStatus(UploadStatus.ERROR)
				console.error("Avatar upload failed:", error)

				// 根据错误类型显示不同的错误信息
				if (error instanceof Error) {
					if (error.message.includes("network")) {
						magicToast.error(t(UPLOAD_ERROR_MESSAGES.NETWORK_ERROR))
					} else if (error.message.includes("permission")) {
						magicToast.error(t(UPLOAD_ERROR_MESSAGES.PERMISSION_ERROR))
					} else {
						magicToast.error(t(UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED))
					}
				} else {
					magicToast.error(t(UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED))
				}
			}
		},
		[validateFile, t, compressFileIfNeeded, uploadFileToServer, autoSave, updateUserAvatar],
	)

	return {
		uploadStatus,
		uploadAvatar,
		isUploading: uploadStatus === UploadStatus.UPLOADING,
		uploadedAvatarUrl,
	}
}
