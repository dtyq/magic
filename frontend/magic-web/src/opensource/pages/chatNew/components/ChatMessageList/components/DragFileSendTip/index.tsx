import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useBoolean, useMemoizedFn } from "ahooks"
import { Flex } from "antd"
import { type PropsWithChildren, type DragEventHandler, memo, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import MessageService from "@/opensource/services/chat/message/MessageService"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import { IconFileUpload, IconLoaderQuarter } from "@tabler/icons-react"
import { genFileData } from "../../../MessageEditor/components/InputFiles/utils"
import { useStyles } from "./styles"

/**
 * 拖拽文件发送提示
 */
const DragFileSendTipComponent = ({ children }: PropsWithChildren) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const [dragEntered, { setTrue: setDragTrue, setFalse: setDragFalse }] = useBoolean(false)
	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const { upload, reportFiles } = useUpload({
		storageType: "private",
	})
	const parentRef = useRef<HTMLDivElement>(null)

	const onDragEnter = useMemoizedFn<DragEventHandler<HTMLElement>>((e) => {
		// console.log("onDragEnter", e, e.target)

		if (dragEntered) return

		const target = e.target as HTMLElement
		if (parentRef.current?.contains(target) || parentRef.current === target) {
			setDragTrue()
		}
	})

	const onDragLeave = useMemoizedFn<DragEventHandler<HTMLElement>>((e) => {
		if (!dragEntered) {
			return
		}

		if (
			parentRef.current === e.target ||
			(e.target as HTMLElement).getAttribute("id") === "drag-file-send-tip-container"
		) {
			setDragFalse()
		}
	})

	const onDrop = useMemoizedFn<DragEventHandler<HTMLElement>>((e) => {
		e.preventDefault()
		e.stopPropagation()

		const conversationId = conversationStore.getCurrentConversation()?.id

		if (!conversationId) {
			return
		}

		const files = Array.from(e.dataTransfer?.files ?? []).map(genFileData)
		if (!files.length) {
			setDragFalse()
			return
		}
		setLoadingTrue()
		upload(files)
			.then(({ fullfilled }) => {
				return reportFiles(
					fullfilled.map((file) => ({
						file_extension: file.value.name.split(".").pop() ?? "",
						file_key: file.value.key,
						file_size: file.value.size,
						file_name: file.value.name,
					})),
				)
			})
			.then((data) => {
				MessageService.formatAndSendMessage(conversationId, {
					type: ConversationMessageType.Files,
					files: {
						attachments: data.map((item) => ({
							file_id: item.file_id,
							file_name: item.file_name,
							file_extension: item.file_extension,
							file_size: item.file_size,
							file_key: item.file_key,
						})),
					},
				})
			})
			.finally(() => {
				setLoadingFalse()
				setDragFalse()
			})
	})

	const Chidlren = useMemo(
		() => (
			<Flex
				vertical
				align="center"
				justify="center"
				id="drag-file-send-tip-container"
				gap={14}
				style={{
					display: dragEntered ? "flex" : "none",
					pointerEvents: dragEntered ? "auto" : "none",
				}}
				className={styles.dragEnteredInnerWrapper}
			>
				<MagicIcon component={IconFileUpload} size={48} color="currentColor" />
				<span className={styles.dragEnteredMainTip}>{t("chat.input.dragFile.tip")}</span>
				<span className={styles.dragEnteredTip}>
					单次发送最多 50 个文件
					<br />
					支持类型：pdf, txt, csv, docx, doc, xlsx, xls, pptx, ppt, md, mobi, epub
				</span>
				{loading && (
					<MagicIcon
						component={IconLoaderQuarter}
						size={24}
						color="currentColor"
						className={styles.dragEnteredLoader}
					/>
				)}
			</Flex>
		),
		[
			dragEntered,
			loading,
			styles.dragEnteredInnerWrapper,
			styles.dragEnteredLoader,
			styles.dragEnteredMainTip,
			styles.dragEnteredTip,
			t,
		],
	)

	return (
		<div
			ref={parentRef}
			id="drag-file-send-tip"
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onDragOver={(e) => e.preventDefault()}
			className={styles.dragEnteredTipWrapper}
		>
			{Chidlren}
			{children}
		</div>
	)
}

const DragFileSendTip = memo(DragFileSendTipComponent)

export default DragFileSendTip
