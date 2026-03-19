import { Form, Flex, Spin, Modal } from "antd"
import { IconFileUpload, IconTrash, IconCircleCheck } from "@tabler/icons-react"
import LoadingOutlined from "@/components/icons/LoadingOutlined"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import { genFileData, getFileExtension } from "@/pages/vectorKnowledge/utils"
import { useUpload } from "@/hooks/useUploadFiles"
import DocumentUpload from "../../Upload/DocumentUpload"
import { getFileIconByExt } from "../../../constant"
import { useVectorKnowledgeCreateStyles } from "../styles"
import { LocalUploadFileItem } from "../index"
import { Knowledge } from "@/types/knowledge"
import magicToast from "@/components/base/MagicToaster/utils"

interface LocalFileProps {
	fileList: LocalUploadFileItem[]
	setFileList: React.Dispatch<React.SetStateAction<LocalUploadFileItem[]>>
}

export default function LocalFile({ fileList, setFileList }: LocalFileProps) {
	const { styles } = useVectorKnowledgeCreateStyles()
	const { t } = useTranslation("flow")

	const { uploadAndGetFileUrl } = useUpload({
		storageType: "private",
	})

	/** 获取文件状态图标 */
	const getFileStatusIcon = useMemoizedFn((file: LocalUploadFileItem) => {
		if (file.status === "done") {
			return <IconCircleCheck color="#32C436" size={24} />
		}
		if (file.status === "error") {
			return (
				<div className={styles.uploadRetry}>
					{t("knowledgeDatabase.uploadRetry")}
					<span
						className={styles.uploadRetryText}
						onClick={() => handleFileUpload(file.file, file.uid)}
					>
						{t("knowledgeDatabase.uploadRetryText")}
					</span>
				</div>
			)
		}
		if (file.status === "uploading") {
			return <Spin indicator={<LoadingOutlined spin />} />
		}
		return null
	})

	/** 上传文档 */
	const handleFileUpload = useMemoizedFn(async (file: File, uid?: string) => {
		// 更新上传的文件列表
		const newUid = uid || `${file.name}-${Date.now()}`
		if (uid) {
			setFileList((prevFileList: LocalUploadFileItem[]) =>
				prevFileList.map((item) =>
					item.uid === uid ? { ...item, status: "uploading" } : item,
				),
			)
		} else {
			setFileList((prevFileList: LocalUploadFileItem[]) => [
				...prevFileList,
				{
					uid: newUid,
					name: file.name,
					file,
					status: "uploading",
					type: Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE,
				},
			])
		}
		// 上传文件
		const newFile = genFileData(file)
		// 已通过 beforeFileUpload 预校验，故传入 () => true 跳过方法校验
		const { fullfilled } = await uploadAndGetFileUrl([newFile], () => true)
		// 更新上传的文件列表状态
		if (fullfilled && fullfilled.length) {
			const { path } = fullfilled[0].value
			setFileList((prevFileList: LocalUploadFileItem[]) =>
				prevFileList.map((item) =>
					item.uid === newUid ? { ...item, status: "done", path } : item,
				),
			)
		} else {
			setFileList((prevFileList: LocalUploadFileItem[]) =>
				prevFileList.map((item) =>
					item.uid === newUid ? { ...item, status: "error" } : item,
				),
			)
		}
	})

	/** 删除文件 */
	const handleLocalFileRemove = useMemoizedFn((e: any, uid: string) => {
		e?.domEvent?.stopPropagation?.()
		Modal.confirm({
			centered: true,
			title: t("knowledgeDatabase.deleteFile"),
			content: t("knowledgeDatabase.deleteDesc"),
			okText: t("button.confirm", { ns: "interface" }),
			cancelText: t("button.cancel", { ns: "interface" }),
			onOk: async () => {
				setFileList((prevFileList: LocalUploadFileItem[]) =>
					prevFileList.filter((item) => item.uid !== uid),
				)
				magicToast.success(t("common.deleteSuccess"))
			},
		})
	})

	return (
		<Form.Item
			label={
				<div className={cx(styles.label, styles.required)}>{t("common.uploadFile")}</div>
			}
		>
			<div>
				<DocumentUpload handleFileUpload={handleFileUpload}>
					<div className={styles.uploadIcon}>
						<IconFileUpload size={40} stroke={1} />
					</div>
					<div className={styles.uploadText}>{t("common.fileDragTip")}</div>
					<div className={styles.uploadDescription}>
						{`${t("common.supported")} TXT、MARKDOWN、PDF、XLSX、XLS、DOCX、CSV、XML`}
						<br />
						{t("common.fileSizeLimit", { size: "15MB" })}
					</div>
				</DocumentUpload>
				{fileList.map((file) => (
					<Flex
						align="center"
						justify="space-between"
						key={file.uid}
						className={styles.fileItem}
					>
						<Flex align="center" gap={8}>
							{getFileIconByExt(getFileExtension(file.name))}
							<div>{file.name}</div>
						</Flex>
						<Flex align="center" gap={8}>
							{getFileStatusIcon(file)}
							<IconTrash
								style={{ cursor: "pointer" }}
								size={24}
								stroke={1.3}
								onClick={(e) => handleLocalFileRemove(e, file.uid)}
							/>
						</Flex>
					</Flex>
				))}
			</div>
		</Form.Item>
	)
}
