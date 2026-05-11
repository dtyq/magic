import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { FileUploadZone } from "../components/FileUploadZone"
import { FileUploadCard, StepNavigation } from "../../../components"
import { useFileValidation, useFileUpload } from "../hooks"
import type { LocalDocumentStore } from "../../../store"
import { formatFileSize } from "@/utils/string"

/**
 * UploadFilesStep组件Props
 */
export interface UploadFilesStepProps {
	store: LocalDocumentStore
	onNext: () => void
	onPrevious: () => void
}

/**
 * Local Documents第1步：上传文件
 */
export const UploadFilesStep = observer(function UploadFilesStep({
	store,
	onNext,
}: Omit<UploadFilesStepProps, "onPrevious">) {
	const { t } = useTranslation("crew/create")
	const { validateFile, showValidationError, limits } = useFileValidation()
	const { handleFileUpload } = useFileUpload((uid, progress) => {
		// 实时更新上传进度到 store
		store.updateFileProgress(uid, progress)
	})

	/**
	 * 处理文件选择
	 */
	const handleFilesSelect = useMemoizedFn(async (files: File[]) => {
		// 1. 先检查总数量限制
		const totalCount = files.length + store.uploadedFiles.length
		if (totalCount > limits.MAX_FILE_COUNT) {
			showValidationError(
				t("documentCreate.upload.error.tooManyFiles", {
					maxCount: limits.MAX_FILE_COUNT,
				}),
			)
			return
		}

		// 2. 分别验证每个文件，区分合格和不合格的文件
		const validFiles: File[] = []
		const invalidFilesMap = new Map<File, string>() // 存储文件及其错误信息

		for (const file of files) {
			const result = validateFile(file)
			if (result.valid) {
				validFiles.push(file)
			} else {
				invalidFilesMap.set(file, result.error || "")
			}
		}

		// 3. 将所有文件添加到store（包括不合格的文件）
		store.addFiles(files)

		// 4. 立即标记不合格文件为 error 状态并保存错误信息
		Array.from(invalidFilesMap.entries()).forEach(([file, error]) => {
			const uid = store.uploadedFiles.find((f) => f.file === file)?.uid
			if (uid) {
				store.updateFileStatus(uid, "error", undefined, error)
			}
		})

		// 5. 并发上传所有合格的文件
		const uploadTasks = validFiles.map(async (file) => {
			const uid = store.uploadedFiles.find((f) => f.file === file)?.uid
			if (!uid) return

			const result = await handleFileUpload(file, uid)
			if (result.success && result.path) {
				store.updateFileStatus(uid, "done", result.path)
			} else {
				store.updateFileStatus(uid, "error", undefined, "上传失败")
			}
		})

		await Promise.allSettled(uploadTasks)
	})

	/**
	 * 处理文件删除
	 */
	const handleFileDelete = useMemoizedFn((uid: string) => {
		store.removeFile(uid)
	})

	/**
	 * 处理文件重试
	 */
	const handleFileRetry = useMemoizedFn(async (uid: string) => {
		const fileItem = store.uploadedFiles.find((f) => f.uid === uid)
		if (!fileItem) return

		// 先验证文件是否合格
		const validation = validateFile(fileItem.file)
		if (!validation.valid) {
			// 如果验证失败，更新错误信息
			store.updateFileStatus(uid, "error", undefined, validation.error)
			return
		}

		// 验证通过，开始上传
		store.updateFileStatus(uid, "uploading", undefined, undefined)
		const result = await handleFileUpload(fileItem.file, uid)
		if (result.success && result.path) {
			store.updateFileStatus(uid, "done", result.path)
		} else {
			store.updateFileStatus(uid, "error", undefined, "上传失败")
		}
	})

	return (
		<div className="flex h-full flex-col">
			{/* 固定区域：上传区域 */}
			<div className="shrink-0 px-8">
				<FileUploadZone onFilesSelect={handleFilesSelect} />
			</div>

			{/* 固定区域：文件列表标题 */}
			{/* {store.uploadedFiles.length > 0 && (
				<div className="shrink-0 px-8 pt-6">
					<div className="text-sm font-medium">
						{t("documentCreate.upload.uploadedFiles", {
							count: store.uploadedFiles.length,
						})}
					</div>
				</div>
			)} */}

			{/* 可滚动区域：文件卡片列表 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-8">
				{store.uploadedFiles.length > 0 && (
					<div className="flex flex-col gap-2 pt-2">
						{store.uploadedFiles.map((file) => (
							<FileUploadCard
								key={file.uid}
								file={{
									name: file.name,
									status: file.status,
									progress: file.progress,
									size: formatFileSize(file.size),
									error: file.error,
								}}
								onDelete={() => handleFileDelete(file.uid)}
								onRetry={() => handleFileRetry(file.uid)}
								showProgress
							/>
						))}
					</div>
				)}
			</div>

			{/* 底部导航 - 紧跟内容 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					showPrevious={false}
					onNext={onNext}
					nextDisabled={!store.canGoNext(1)}
					nextLoading={store.uploadedFiles.some((f) => f.status === "uploading")}
				/>
			</div>
		</div>
	)
})
