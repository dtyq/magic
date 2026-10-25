import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { normalizeWorkspaceRelativePath } from "./identity-markdown"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { FileApi } from "@/apis"
import { crewService } from "@/services/crew/CrewService"

const SUPPORTED_AVATAR_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".bmp"]

/**
 * 寻找工作区中的员工头像文件（优先 .magic/logo.png / .magic/logo.jpg 等）
 */
export function findWorkspaceAvatarFile(
	files: AttachmentItem[],
	iconPath?: string,
): AttachmentItem | null {
	const normalizedIconPath = iconPath ? normalizeWorkspaceRelativePath(iconPath) : ""

	if (
		normalizedIconPath &&
		!normalizedIconPath.startsWith("http://") &&
		!normalizedIconPath.startsWith("https://")
	) {
		const exact = files.find((file) => {
			if (file.is_directory) return false
			const filePath = normalizeWorkspaceRelativePath(
				file.relative_file_path ?? file.file_path ?? file.path ?? "",
			)
			return (
				filePath === normalizedIconPath ||
				filePath === `.magic/${normalizedIconPath}` ||
				(normalizedIconPath.startsWith(".magic/") &&
					filePath === normalizedIconPath.replace(/^\.magic\//, ""))
			)
		})
		if (exact) return exact
	}

	// 优先查找 .magic/logo.png, .magic/logo.jpg 或 .magic/ 下的直接图片文件
	const directLogoCandidate = files.find((file) => {
		if (file.is_directory) return false
		const filePath = normalizeWorkspaceRelativePath(
			file.relative_file_path ?? file.file_path ?? file.path ?? "",
		)
		const ext = `.${(
			file.file_extension ??
			file.file_name?.split(".").pop() ??
			file.name?.split(".").pop() ??
			""
		).toLowerCase()}`
		if (
			filePath === ".magic/logo.png" ||
			filePath === ".magic/logo.jpg" ||
			filePath === "logo.png" ||
			filePath === "logo.jpg"
		) {
			return true
		}
		const isDirectUnderMagic =
			filePath.startsWith(".magic/") && !filePath.replace(/^\.magic\//, "").includes("/")
		return isDirectUnderMagic && SUPPORTED_AVATAR_EXTENSIONS.includes(ext)
	})
	if (directLogoCandidate) return directLogoCandidate

	// 降级查找 .magic/avatars/ 或 avatars/ 目录下的图片文件
	const avatarCandidate = files.find((file) => {
		if (file.is_directory) return false
		const filePath = normalizeWorkspaceRelativePath(
			file.relative_file_path ?? file.file_path ?? file.path ?? "",
		)
		const isUnderAvatars =
			filePath.startsWith(".magic/avatars/") || filePath.startsWith("avatars/")
		const ext = `.${(
			file.file_extension ??
			file.file_name?.split(".").pop() ??
			file.name?.split(".").pop() ??
			""
		).toLowerCase()}`
		return isUnderAvatars && SUPPORTED_AVATAR_EXTENSIONS.includes(ext)
	})

	return avatarCandidate ?? null
}

export interface EnsureWorkspaceAvatarUploadedOptions {
	crewCode: string
	currentIcon?: { type?: string; value?: string } | null
	workspaceFiles: AttachmentItem[]
	upload: (fileList: { name: string; file: File; status: "init" }[]) => Promise<{
		fullfilled: { value?: { key?: string } }[]
	}>
	onAvatarUploaded?: (avatarUrl: string) => void
}

/**
 * 在发布数字员工时，检查头像是否属于工作区本地文件；
 * 若是，则将其上传至公用桶（Public Bucket）并更新服务端 file_key 和 icon URL。
 */
export async function ensureWorkspaceAvatarUploaded({
	crewCode,
	currentIcon,
	workspaceFiles,
	upload,
	onAvatarUploaded,
}: EnsureWorkspaceAvatarUploadedOptions): Promise<string | null> {
	if (!crewCode) return null

	const iconVal = currentIcon?.value?.trim() ?? ""
	// 若已经是公网 http/https URL，无需重复上传
	if (iconVal.startsWith("http://") || iconVal.startsWith("https://")) {
		return null
	}

	const avatarItem = findWorkspaceAvatarFile(workspaceFiles, iconVal)
	if (!avatarItem?.file_id) {
		return null
	}

	try {
		const blob = await getFileContentById(avatarItem.file_id, { responseType: "blob" })
		const fileName = avatarItem.file_name || avatarItem.name || "logo.png"
		const file = new File([blob as Blob], fileName, {
			type: (blob as Blob).type || "image/png",
		})

		const { fullfilled } = await upload([{ name: file.name, file, status: "init" }])
		const uploadedIconKey = fullfilled[0]?.value?.key
		if (!uploadedIconKey) {
			throw new Error("Upload avatar failed: missing key in response")
		}

		const [reportedFile] = await FileApi.reportFileUploads([
			{
				file_extension: file.name.split(".").pop() ?? "",
				file_key: uploadedIconKey,
				file_size: file.size,
				file_name: file.name,
			},
		])

		if (!reportedFile?.file_key) {
			throw new Error("Report avatar upload failed: missing reported file_key")
		}

		const fileUrl = await FileApi.getFileUrl(reportedFile.file_key)
		const remoteUrl = fileUrl.url

		await crewService.updateAgentInfo(crewCode, {
			icon: { type: "Image", value: remoteUrl },
			icon_type: 2,
			file_key: reportedFile.file_key,
		})

		onAvatarUploaded?.(remoteUrl)
		return reportedFile.file_key
	} catch (error) {
		console.warn("Failed to upload workspace avatar to public bucket during publish:", error)
		return null
	}
}
