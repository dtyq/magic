import { memo, useRef } from "react"
import { Flex, message } from "antd"
import { useTranslation } from "react-i18next"
import { IconPhotoPlus, IconTrash, IconCircle, IconCheck } from "@tabler/icons-react"
import { UploadButton, MagicAvatar, WarningModal } from "components"
import { useMemoizedFn } from "ahooks"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { IMAGE_TYPE } from "@/const/common"
import { getImageInfo } from "@/utils/imgTool"
import { useApis } from "@/apis"
import { useUpload } from "@/hooks/useUpload"
import type { Upload } from "@/types/upload"
import { genFileData } from "@/utils/file"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useStyles } from "./styles"

interface ModelIconsProps {
	icons: AiManage.Icon[]
	selectedIcon?: string
	businessType?: AiModel.BusinessType
	setIcons: React.Dispatch<React.SetStateAction<AiManage.Icon[]>>
	handleSelectIcon: (key?: string) => void
}

export const ModelIcons = memo(
	({
		icons,
		setIcons,
		selectedIcon,
		handleSelectIcon,
		businessType = AiModel.BusinessType.ServiceProvider,
	}: ModelIconsProps) => {
		const { t } = useTranslation("admin/ai/model")
		const { t: tCommon } = useTranslation("admin/common")

		const { AIManageApi } = useApis()
		const { styles } = useStyles()

		const openModal = useOpenModal()

		/* 上传的列表 */
		const uploadList = useRef<string[]>([])

		const { uploadAndGetFileUrl, uploading } = useUpload<Upload.FileData>({
			storageType: "public",
		})

		const beforeUpload = useMemoizedFn(async (fileList: Upload.FileData[]) => {
			if (fileList.length > 1) return false
			const { file } = fileList[0]
			if (!file) return false
			const isJpgOrPng = IMAGE_TYPE.includes(file.type)
			if (!isJpgOrPng) {
				message.error(t("form.uploadTypeError"))
				return false
			}
			return isJpgOrPng
		})

		const handleDeleteIcon = async (key: string, url: string) => {
			openModal(WarningModal, {
				open: true,
				content: <MagicAvatar className={styles.avatar} src={url} size={44} border />,
				onOk: async () => {
					setIcons((prev) => prev.filter((icon) => icon.key !== key))
					uploadList.current.filter((path) => path !== key)
					await AIManageApi.deleteFile({
						file_key: key,
						business_type: businessType,
					})
					message.success(tCommon("message.deleteSuccess"))
				},
			})
		}

		const onFileChange = useMemoizedFn(async (fileList: FileList) => {
			const newFiles = Array.from(fileList).map(genFileData)

			const isValid = await beforeUpload(newFiles)
			if (!isValid) return

			const { fullfilled } = await uploadAndGetFileUrl(newFiles)

			if (fullfilled.length) {
				const { path, url } = fullfilled[0].value
				const newIcon = {
					key: path,
					url,
					type: AiModel.FileType.NonOfficial,
				}
				setIcons((prev) => {
					return [...prev, newIcon]
				})
				uploadList.current.push(path)
				handleSelectIcon(path)
			}
		})

		const selectIcon = useMemoizedFn((key?: string) => {
			if (selectedIcon === key) {
				handleSelectIcon()
			} else {
				handleSelectIcon(key)
			}
		})

		return (
			<Flex gap={8} vertical>
				<Flex gap={8} className={styles.iconList}>
					{icons?.map(({ key, url, type }) => {
						return (
							<div className={styles.avatarItem} key={key}>
								<MagicAvatar
									className={styles.avatar}
									key={key}
									src={url}
									size={44}
									border
									onClick={() => selectIcon(key)}
									badgeProps={{
										count:
											type === AiModel.FileType.NonOfficial ? (
												<IconTrash
													size={18}
													className={styles.iconTrash}
													onClick={() => handleDeleteIcon(key, url)}
												/>
											) : undefined,
									}}
								/>
								{selectedIcon === key && (
									<div className={styles.iconCheck}>
										<IconCircle size={20} fill="currentColor" stroke={0} />
										<IconCheck
											size={10}
											stroke={3}
											className={styles.iconCheckMark}
										/>
									</div>
								)}
							</div>
						)
					})}
				</Flex>
				<div>
					<UploadButton
						className={styles.upload}
						loading={uploading}
						onFileChange={onFileChange}
						icon={<IconPhotoPlus size={24} stroke={2} />}
						multiple={false}
					>
						{t("form.uploadModalIcon")}
					</UploadButton>
				</div>
				<div className={styles.desc}>{t("form.uploadModalIconDesc")}</div>
			</Flex>
		)
	},
)
