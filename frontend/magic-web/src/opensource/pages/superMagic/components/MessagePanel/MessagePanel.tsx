import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import UploadAction from "@/opensource/components/base/UploadAction"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { formatFileSize } from "@/utils/string"
import { IconFileUpload, IconSend, IconX, IconSchool } from "@tabler/icons-react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import TaskIcon from "@/opensource/pages/superMagic/assets/svg/task_mode.svg"
import { Button, Input, message, Tooltip } from "antd"
import { cx } from "antd-style"
import type { TextAreaRef } from "antd/es/input/TextArea"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import InterruptSvg from "../../assets/svg/interrupt.svg"
import type { FileItem } from "../../pages/Workspace/types"
import TaskList from "../TaskList"
import { useStyles } from "./styles"
import { FileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { genFileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/utils"

export interface MessagePanelProps {
	onSendMessage?: (content: string, options?: any) => void
	fileList?: FileItem[]
	setFileList?: (fileList: any[]) => void
	taskData?: any
	className?: string
	textAreaWrapperClassName?: string
	containerRef?: React.RefObject<HTMLDivElement>
	showLoading?: boolean
	selectedThreadInfo?: any
	isEmptyStatus?: boolean
	topicModeInfo?: string
}

const MessagePanel: React.FC<MessagePanelProps> = ({
	onSendMessage,
	fileList,
	setFileList,
	taskData,
	className,
	textAreaWrapperClassName,
	containerRef,
	showLoading,
	selectedThreadInfo,
	isEmptyStatus,
	topicModeInfo,
}) => {
	const { styles } = useStyles()
	const textAreaRef = useRef<TextAreaRef>(null)
	const [inputValue, setInputValue] = React.useState("")
	const [composition, setComposition] = React.useState(false)
	const [inputMode, setInputMode] = useState<"chat" | "plan">("plan")
	const [uploading, setUploading] = useState(false)
	const { t } = useTranslation("interface")
	const { TextArea } = Input

	const { upload, reportFiles } = useUpload<FileData>({
		storageType: "private",
	})

	// 附件上传
	const onFileChange = useMemoizedFn(async (files: FileList) => {
		try {
			setUploading(true)
			message.loading({ content: "文件上传中...", key: "fileUpload" })
			const newFiles = Array.from(files).map(genFileData)
			const { fullfilled } = await upload(newFiles)

			// 检查是否所有文件都上传成功
			if (fullfilled.length !== newFiles.length) {
				message.error({ content: t("file.uploadFail"), key: "fileUpload" })
				return null
			}
			const data = fullfilled.map(({ value }) => ({
				file_key: value.key,
				file_name: value.name,
				file_size: value.size,
				file_extension: value?.name?.split(".").pop(),
			}))
			const res = await reportFiles(data)
			// 合并新上传的文件和现有文件列表
			setFileList?.([...(fileList || []), ...res])
			message.success({ content: "文件上传成功", key: "fileUpload" })
			return null
		} catch (error) {
			message.error({ content: "文件上传失败", key: "fileUpload" })
			return null
		} finally {
			setUploading(false)
		}
	})
	const handleSend = useCallback(() => {
		if (inputValue.trim()) {
			const data = isEmptyStatus
				? {
						instructs: [{ value: inputMode }],
				  }
				: {}
			onSendMessage?.(inputValue, data)
			setInputValue("")
			setFileList?.([])
		}
	}, [inputValue, inputMode, onSendMessage, setFileList, isEmptyStatus])

	const onPressEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (composition) {
			return
		}
		const { metaKey, shiftKey, ctrlKey } = event
		event.preventDefault()
		if (metaKey || ctrlKey || shiftKey) {
			const textArea = textAreaRef.current?.resizableTextArea?.textArea
			const cursorPosition = textArea?.selectionStart || 0
			setInputValue((oldState) => {
				const oldMessage = oldState || ""
				return `${oldMessage.slice(0, cursorPosition)}\n${oldMessage.slice(cursorPosition)}`
			})
			setTimeout(() => {
				textArea?.setSelectionRange(cursorPosition + 1, cursorPosition + 1, "none")
				if (textArea?.value.length === cursorPosition + 1) {
					textArea?.scrollBy({
						behavior: "smooth",
						top: Number.MAX_SAFE_INTEGER,
					})
				}
			})
		}
		if (!metaKey && !shiftKey && !ctrlKey) {
			handleSend?.()
		}
	}

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInputValue(e.target.value)
	}

	const handleFileChange = useCallback(
		(files: FileList) => {
			if (uploading) {
				message.info("文件正在上传中，请稍候")
				return
			}
			console.log("选择的文件:", files, "fileList", fileList)
			onFileChange(files)
		},
		[onFileChange, fileList, uploading],
	)

	const handleRemoveFile = (key: string | undefined) => {
		const updatedFileList = fileList?.filter((file: any) => file.file_key !== key)
		setFileList?.(updatedFileList || [])
	}

	useEffect(() => {
		setInputValue("")
		setFileList?.([])
	}, [selectedThreadInfo])

	const { run: handleInterrupt } = useDebounceFn(
		() => {
			onSendMessage?.("终止任务", {
				instructs: [{ value: "interrupt" }],
			})
			console.log("中断")
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	const sendButtonDisabled = useMemo(() => {
		if (inputValue.trim()?.length && selectedThreadInfo?.id) {
			return false
		}
		return true
	}, [inputValue, selectedThreadInfo])

	const getFileType = (fileName: string) => {
		const fileType = fileName.split(".").pop()
		return fileType
	}

	return (
		<div ref={containerRef} className={cx(styles.container, className)}>
			<div className={styles.inputArea}>
				{taskData?.process?.length > 0 && (
					<div className={styles.taskListWrapper}>
						<TaskList taskData={taskData} isInChat />
					</div>
				)}
				<div className={styles.inputGroup}>
					{!!fileList && fileList.length > 0 && (
						<div className={styles.fileList}>
							{fileList.map((file: FileItem) => (
								<div key={file.file_id} className={styles.fileItem}>
									<Tooltip
										title={file.file_name}
										placement="top"
										mouseEnterDelay={0.5}
									>
										<div className={styles.fileItemContent}>
											<MagicFileIcon
												type={getFileType(file?.file_name || "")}
												size={14}
											/>
											<span className={styles.fileName}>
												{file.file_name}
											</span>
											<span className={styles.fileSize}>
												{formatFileSize(file.file_size)}
											</span>
										</div>
									</Tooltip>
									<div
										className={styles.deleteIcon}
										onClick={() => handleRemoveFile(file.file_key)}
									>
										<MagicIcon
											component={IconX}
											size={10}
											stroke={2}
											style={{ stroke: "white" }}
										/>
									</div>
								</div>
							))}
						</div>
					)}

					<div className={cx(styles.textAreaWrapper, textAreaWrapperClassName)}>
						<TextArea
							ref={textAreaRef}
							autoSize={false}
							value={inputValue}
							onChange={handleInput}
							onPressEnter={onPressEnter}
							className={styles.textArea}
							style={{ resize: "none" }}
							placeholder={
								showLoading
									? "您可以继续和我对话来实时调整任务哦"
									: "给超级麦吉一个任务..."
							}
							onCompositionStart={() => setComposition(true)}
							onCompositionEnd={() => setComposition(false)}
						/>
					</div>

					<div className={styles.toolBar}>
						<div className={styles.toolBarLeft}>
							{isEmptyStatus && (
								<div className={styles.modeToggle}>
									{isEmptyStatus ? (
										<>
											<Tooltip
												title="AI自主规划决策，并分步自动执行"
												placement="top"
											>
												<div
													className={cx(
														styles.modeToggleButton,
														inputMode === "plan" &&
															styles.modeToggleButtonActive,
													)}
													onClick={() => setInputMode("plan")}
												>
													<img
														src={TaskIcon}
														alt=""
														className={styles.taskIcon}
													/>
													任务
												</div>
											</Tooltip>
											<Tooltip
												title="AI 单步执行，人与AI多轮对话协同完成任务"
												placement="top"
											>
												<div
													className={cx(
														styles.modeToggleButton,
														inputMode === "chat" &&
															styles.modeToggleButtonActive,
													)}
													onClick={() => setInputMode("chat")}
												>
													<MagicIcon component={IconSchool} size={16} />
													{"专业"}
												</div>
											</Tooltip>
										</>
									) : (
										<>
											{topicModeInfo === "plan" && (
												<div
													className={cx(
														styles.modeToggleButton,
														styles.modeToggleButtonActive,
													)}
												>
													<img
														src={TaskIcon}
														alt=""
														className={styles.taskIcon}
													/>
													任务
												</div>
											)}
											{topicModeInfo === "chat" && (
												<div
													className={cx(
														styles.modeToggleButton,
														styles.modeToggleButtonActive,
													)}
												>
													<MagicIcon component={IconSchool} size={16} />
													{"专业"}
												</div>
											)}
										</>
									)}
								</div>
							)}
							{!isEmptyStatus && topicModeInfo && (
								<div className={styles.modeToggle}>
									{topicModeInfo === "plan" && (
										<Tooltip
											title="AI自主规划决策，并分步自动执行"
											placement="top"
										>
											<div
												className={cx(
													styles.modeToggleButton,
													styles.modeToggleButtonActive,
												)}
											>
												<img
													src={TaskIcon}
													alt=""
													className={styles.taskIcon}
												/>
												任务
											</div>
										</Tooltip>
									)}
									{topicModeInfo === "chat" && (
										<Tooltip
											title="AI 单步执行，人与AI多轮对话协同完成任务"
											placement="top"
										>
											<div
												className={cx(
													styles.modeToggleButton,
													styles.modeToggleButtonActive,
												)}
											>
												<MagicIcon component={IconSchool} size={16} />
												{"专业"}
											</div>
										</Tooltip>
									)}
								</div>
							)}
							<UploadAction
								multiple
								onFileChange={handleFileChange}
								handler={(trigger) => (
									<Button
										className={styles.toolBarButton}
										onClick={trigger}
										icon={<MagicIcon component={IconFileUpload} size={20} />}
										type="text"
									>
										文件
									</Button>
								)}
							/>
						</div>
						<div className={styles.toolBarRight}>
							{showLoading && (
								<span onClick={handleInterrupt} className={styles.interruptIcon}>
									<img src={InterruptSvg} alt="" />
								</span>
							)}
							<Button
								disabled={sendButtonDisabled}
								className={cx(
									styles.sendButton,
									sendButtonDisabled && styles.sendButtonDisabled,
								)}
								type="primary"
								icon={<MagicIcon component={IconSend} size={20} />}
								onClick={handleSend}
							>
								发送
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default MessagePanel
