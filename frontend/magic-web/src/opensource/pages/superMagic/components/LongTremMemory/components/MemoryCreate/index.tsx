import { useStyles } from "./styles"
import { SourceType } from "./types"
import TextSource from "./source/TextSource"
import FileSource from "./source/FileSource"
import CloudDriveSource from "./source/CloudDriveSource"
import LinkSource from "./source/LinkSource"
import { createElement, useEffect, useState } from "react"
import { Button } from "antd"
import { useTranslation } from "react-i18next"
import { LongTremMemoryPage, PageProps } from "../../types"
import { useMemoizedFn } from "ahooks"
import { LongMemoryApi } from "@/opensource/apis"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { IconChevronLeft, IconX } from "@tabler/icons-react"
import { LongMemory } from "@/opensource/types/longMemory"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const SourceComponent = {
	[SourceType.Text]: TextSource,
	[SourceType.File]: FileSource,
	[SourceType.CloudDrive]: CloudDriveSource,
	[SourceType.Link]: LinkSource,
}

export default function MemoryCreate({
	editMemory,
	setBreadcrumbList,
	setPage,
	onClose,
}: PageProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	/** 记忆的资源类型 */
	const [source, setSource] = useState<SourceType>(SourceType.Text)
	/** 创建/编辑的记忆内容 */
	const [content, setContent] = useState<string>("")
	/** 选中的项目ID */
	const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
	/** 确认 loading */
	const [confirmLoading, setConfirmLoading] = useState(false)

	const handleConfirm = useMemoizedFn(async () => {
		if (!content || !content.trim() || confirmLoading) return
		setConfirmLoading(true)
		if (!editMemory) {
			const res = await LongMemoryApi.createMemory({
				content: content.trim(),
				project_id: selectedProjectId,
			})
			if (res.message) {
				magicToast.success(res.message)
				setContent("")
				setSelectedProjectId(undefined)
				handleBack()
			}
		} else {
			const res = await LongMemoryApi.setMemory(editMemory.id, { content: content.trim() })
			if (res.success) {
				magicToast.success(res.message)
				setContent("")
				handleBack()
			}
		}
		setConfirmLoading(false)
	})

	/** 仅修改记忆 */
	const handleOnlyEdit = useMemoizedFn(async () => {
		if (!content || !content.trim() || !editMemory || confirmLoading) return
		setConfirmLoading(true)
		const res = await LongMemoryApi.setMemory(editMemory.id, {
			pending_content: content.trim(),
		})
		if (res.success) {
			magicToast.success(res.message)
			setContent("")
			handleBack()
		}
		setConfirmLoading(false)
	})

	/** 修改并采纳记忆 */
	const handleEditAndAccept = useMemoizedFn(async () => {
		if (!content || !content.trim() || !editMemory || confirmLoading) return
		setConfirmLoading(true)
		const editRes = await LongMemoryApi.setMemory(editMemory.id, {
			pending_content: content.trim(),
		})
		if (editRes.success) {
			const acceptRes = await LongMemoryApi.batchAcceptMemories([editMemory.id], "accept")
			if (acceptRes.success) {
				magicToast.success(acceptRes.message)
				setContent("")
				handleBack()
			}
		}
		setConfirmLoading(false)
	})

	/** 返回 */
	const handleBack = useMemoizedFn(() => {
		if (
			editMemory &&
			[LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION].includes(
				editMemory.status,
			)
		) {
			setPage(LongTremMemoryPage.Suggestion)
		} else {
			setPage(LongTremMemoryPage.List)
		}
	})

	useEffect(() => {
		if (!editMemory) {
			setContent("")
			setBreadcrumbList([t("createMemory")])
			return
		}
		if (
			[LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION].includes(
				editMemory.status,
			)
		) {
			setContent(editMemory.pending_content)
			setBreadcrumbList([t("memorySuggestion"), t("edit")])
		} else {
			setContent(editMemory.origin_text || editMemory.content)
		}
	}, [editMemory])

	return (
		<>
			{isMobile && (
				<div className={styles.header}>
					<div className={styles.back} onClick={handleBack}>
						<IconChevronLeft size={24} stroke={1.5} />
					</div>
					<div className={styles.title}>
						{editMemory ? t("editMemory") : t("createMemory")}
					</div>
					<div className={styles.close} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
			)}
			<div className={styles.wrapper}>
				{/* <div className={styles.menu}>
				<div className={styles.menuHeader}>{t("selectContentSource")}</div>
				<div className={styles.menuWrapper}>
					<div className={styles.menuCard} onClick={() => setSource(SourceType.Text)}>
						<div className={styles.menuCardIcon}></div>
						<span>{t("text")}</span>
					</div>
					<div className={styles.menuCard} onClick={() => setSource(SourceType.File)}>
						<div className={styles.menuCardIcon}></div>
						<span>本地文件</span>
					</div>
					<div
						className={styles.menuCard}
						onClick={() => setSource(SourceType.CloudDrive)}
					>
						<div className={styles.menuCardIcon}></div>
						<span>企业文件</span>
					</div>
					<div className={styles.menuCard} onClick={() => setSource(SourceType.Link)}>
						<div className={styles.menuCardIcon}></div>
						<span>网页链接</span>
					</div>
				</div>
			</div> */}
				<div className={styles.body}>
					{createElement(SourceComponent[source], {
						editMemory,
						memoryContent: content,
						setMemoryContent: setContent,
						selectedProjectId,
						setSelectedProjectId,
					})}
				</div>
				<div className={styles.footer}>
					<Button
						className={styles.cancelButton}
						color="default"
						variant="outlined"
						onClick={handleBack}
					>
						{t("cancel")}
					</Button>
					{editMemory &&
					[
						LongMemory.MemoryStatus.Pending,
						LongMemory.MemoryStatus.PENDING_REVISION,
					].includes(editMemory.status) ? (
						<>
							<Button
								className={styles.editButton}
								loading={confirmLoading}
								disabled={!content || !content.trim() || confirmLoading}
								onClick={handleOnlyEdit}
							>
								{t("onlyEdit")}
							</Button>
							<Button
								className={styles.confirmButton}
								type="primary"
								loading={confirmLoading}
								disabled={!content || !content.trim() || confirmLoading}
								onClick={handleEditAndAccept}
							>
								{t("editAndAccept")}
							</Button>
						</>
					) : (
						<Button
							className={styles.confirmButton}
							type="primary"
							loading={confirmLoading}
							disabled={!content || !content.trim() || confirmLoading}
							onClick={handleConfirm}
						>
							{t("confirm")}
						</Button>
					)}
				</div>
			</div>
		</>
	)
}
