import { ResourceType, ShareType } from "../components/Share/types"
import { clipboard } from "@/utils/clipboard-helpers"
import { downloadFileContent, getTemporaryDownloadUrl } from "./api"
import i18n from "i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

export const handleShareFunction = ({
	type,
	extraData,
	topicId,
	resourceType,
}: {
	type: ShareType
	extraData: any
	topicId: string
	resourceType: ResourceType
}) => {
	// 创建或更新分享设置
	const data = {
		resource_id: topicId || "",
		resource_type: resourceType,
		share_type: type,
		password: extraData.passwordEnabled ? extraData.password : "",
	} as any
	SuperMagicApi.createShareTopic(data)
		.then(() => {
			magicToast.success(i18n.t("super:share.settingsSaved"))
		})
		.catch((err: any) => {
			magicToast.error(i18n.t("super:share.createFailed"))
			console.error("创建分享失败:", err)
		})
}

export const copyFileContent = async (
	fileList: any[],
	t: any,
	fileId: string,
	fileContent?: string,
	fileVersion?: number,
) => {
	const file = fileList.find((f) => f.file_id === fileId)
	if (!fileId && !fileContent) return

	try {
		let textToCopy = ""

		if (fileContent && !fileVersion) {
			textToCopy = fileContent
		} else if (file?.content && !fileVersion) {
			textToCopy = file.content
		} else {
			try {
				const response = await getTemporaryDownloadUrl({
					file_ids: [fileId],
					file_versions: fileVersion
						? {
							[fileId]: fileVersion,
						}
						: undefined,
				})
				const downloadUrl = response?.[0]?.url
				if (downloadUrl) {
					textToCopy = await downloadFileContent(downloadUrl)
				} else {
					magicToast.info(t("common.noContentToCopy"))
					return
				}
			} catch (fetchError) {
				console.error("Failed to fetch file content:", fetchError)
				magicToast.info(t("common.noContentToCopy"))
				return
			}
		}

		await clipboard.writeText(textToCopy)
		magicToast.success(t("common.copySuccess"))
	} catch (error) {
		console.error("Copy failed:", error)
		magicToast.error(t("common.copyFailed"))
	}
}
