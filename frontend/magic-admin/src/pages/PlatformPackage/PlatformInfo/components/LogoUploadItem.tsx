import React, { useMemo } from "react"
import { IconUpload } from "@tabler/icons-react"
import { useAdminStore } from "@/stores/admin"
import { useTranslation } from "react-i18next"
import { Flex, message } from "antd"
import { useMemoizedFn } from "ahooks"
import { MagicButton, UploadAction } from "components"
import { useUpload } from "@/hooks/useUpload"
import { genFileData } from "@/utils/file"
import type { Upload } from "@/types/upload"
import { useStyles } from "../styles"
import { PlatformLogoType } from "../index.page"

interface LogoUploadItemComponentProps {
	type: PlatformLogoType
	imagePreviewUrl: Record<PlatformLogoType, string>
	setImagePreviewUrl: React.Dispatch<React.SetStateAction<Record<PlatformLogoType, string>>>
	setImageUploadUrl: React.Dispatch<React.SetStateAction<Record<PlatformLogoType, string>>>
	setImageUploadKey?: React.Dispatch<React.SetStateAction<Record<PlatformLogoType, string>>>
}

const LogoUploadItemComponent = ({
	type,
	imagePreviewUrl,
	setImagePreviewUrl,
	setImageUploadUrl,
	setImageUploadKey,
}: LogoUploadItemComponentProps) => {
	const { siderCollapsed } = useAdminStore()

	const { styles, cx } = useStyles({ siderCollapsed })

	const { t } = useTranslation("interface")
	const { t: tPlatform } = useTranslation("admin/platform/info")

	const { uploading, uploadAndGetFileUrl } = useUpload<Upload.FileData>({
		storageType: "public",
	})

	const uploadValidator = useMemoizedFn((file: File) => {
		if (file.size && file.size > 2 * 1024 * 1024) {
			message.error(tPlatform("uploadSizeLimit"))
			return false
		}
		return true
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList, logoType: PlatformLogoType) => {
		const targetFile = fileList[0]
		// 创建本地URL用于预览
		const localPreviewUrl = URL.createObjectURL(targetFile)
		const newFiles = Array.from(fileList).map(genFileData)
		// 先上传文件
		const { fullfilled } = await uploadAndGetFileUrl(newFiles, uploadValidator)
		if (fullfilled.length) {
			const { path, url } = fullfilled[0].value
			setImagePreviewUrl((prev) => ({ ...prev, [logoType]: localPreviewUrl }))
			setImageUploadUrl((prev) => ({ ...prev, [logoType]: url }))
			setImageUploadKey?.((prev) => ({ ...prev, [logoType]: path }))
		} else {
			message.error(t("file.uploadFail", { ns: "message" }))
		}
	})

	const logoLabel = useMemo(() => {
		switch (type) {
			case PlatformLogoType.ZH:
				return tPlatform("platformZhLogo")
			case PlatformLogoType.EN:
				return tPlatform("platformEnLogo")
			case PlatformLogoType.MINIMAL:
				return tPlatform("platformGraphicLogo")
			case PlatformLogoType.FAVICON:
				return tPlatform("platformFavicon")
			default:
				return ""
		}
	}, [type, tPlatform])

	return (
		<div className={styles.formItem}>
			<div className={styles.formItemLabel}>
				<span>{logoLabel}</span>
				<span className={styles.formItemLabelRequired}>*</span>
			</div>
			<Flex
				flex={1}
				justify="space-between"
				align="center"
				gap={10}
				className={styles.formItemContent}
			>
				<div
					className={cx(styles.platformLogoImageWrapper, {
						[styles.platformLogoImageWrapperBorder]: !!imagePreviewUrl[type],
					})}
				>
					{imagePreviewUrl[type] && (
						<img
							className={styles.platformLogoImage}
							src={imagePreviewUrl[type]}
							draggable={false}
							alt=""
						/>
					)}
				</div>

				<UploadAction
					multiple={false}
					accept="image/*"
					handler={(onUpload) => (
						<Flex vertical align="flex-start" gap={6}>
							<MagicButton
								className={styles.uploadLogoButton}
								onClick={onUpload}
								icon={<IconUpload size={20} />}
								loading={uploading}
							>
								{tPlatform("uploadLogo")}
							</MagicButton>
							<div className={styles.formItemLabelTip}>
								{tPlatform("uploadSvgTip")}
							</div>
						</Flex>
					)}
					onFileChange={(fileList) => onFileChange(fileList, type)}
				/>
			</Flex>
		</div>
	)
}

export default LogoUploadItemComponent
