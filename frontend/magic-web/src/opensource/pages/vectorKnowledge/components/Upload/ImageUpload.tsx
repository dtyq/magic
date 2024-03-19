import { Flex, Upload } from "antd"
import type { PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import { IconPhotoPlus } from "@tabler/icons-react"
import { genFileData } from "@/opensource/pages/vectorKnowledge/utils"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import DEFAULT_KNOWLEDGE_ICON from "@/opensource/assets/logos/knowledge-avatar.png"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface ImageUploadProps {
	previewIconUrl: string
	setPreviewIconUrl: (url: string) => void
	setUploadIconUrl: (url: string) => void
	className?: string
}

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		icon: css`
			width: 45px;
			height: 45px;
			border-radius: 6px;
		`,
		iconUploader: css`
			height: 45px;
			padding: 0 10px;
			font-weight: 500;
			font-size: 13px;
			color: rgba(28, 29, 35, 0.6);
			background: rgba(46, 47, 56, 0.05);
			border: 1px dashed rgba(28, 29, 35, 0.08);
			border-radius: 6px;
			cursor: pointer;
		`,
		iconUploaderTip: css`
			font-size: 12px;
			color: #999;
		`,
	}
})

export default function ImageUpload({
	previewIconUrl,
	setPreviewIconUrl,
	setUploadIconUrl,
	className,
}: PropsWithChildren<ImageUploadProps>) {
	const { t: flowT } = useTranslation("flow")

	const { styles } = useStyles()

	const { uploadAndGetFileUrl } = useUpload({
		storageType: "private",
	})

	/** 上传图标文件 */
	const handleIconFileUpload = useMemoizedFn(async (iconFiles: File[]) => {
		// 创建本地URL用于预览
		const localPreviewUrl = URL.createObjectURL(iconFiles[0])
		const newFiles = iconFiles.map(genFileData)
		// 先上传文件
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { path } = fullfilled[0].value
			setPreviewIconUrl(localPreviewUrl)
			setUploadIconUrl(path)
			magicToast.success(flowT("knowledgeDatabase.uploadSuccess"))
		} else {
			magicToast.error(flowT("file.uploadFail", { ns: "message" }))
		}
	})

	/** 上传图标文件 - 预校验 */
	const beforeIconUpload = useMemoizedFn((file: File) => {
		const isJpgOrPng = ["image/jpeg", "image/png"].includes(file.type)
		if (!isJpgOrPng) {
			magicToast.error(flowT("knowledgeDatabase.onlySupportJpgPng"))
			return false
		}
		const isLt200K = file.size / 1024 < 200
		if (!isLt200K) {
			magicToast.error(flowT("knowledgeDatabase.imageSizeLimit", { size: "200KB" }))
			return false
		}
		handleIconFileUpload([file])
		return false
	})

	return (
		<Flex align="center" gap={8} className={className}>
			<img className={styles.icon} src={previewIconUrl || DEFAULT_KNOWLEDGE_ICON} alt="" />
			<Upload
				accept="image/jpg,image/png,image/jpeg"
				showUploadList={false}
				beforeUpload={beforeIconUpload}
			>
				<Flex align="center" gap={8} className={styles.iconUploader}>
					<IconPhotoPlus size={20} />
					<div style={{ whiteSpace: "nowrap" }}>
						{flowT("knowledgeDatabase.uploadNewIcon")}
					</div>
				</Flex>
			</Upload>
			<div className={styles.iconUploaderTip}>{flowT("knowledgeDatabase.iconFileLimit")}</div>
		</Flex>
	)
}
