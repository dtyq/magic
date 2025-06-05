import { Modal } from "antd"
import { useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import Draggable from "react-draggable"
import { ResizableBox } from "react-resizable"
import type { ResizeCallbackData } from "react-resizable"
import { observer } from "mobx-react-lite"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/ImagePreviewStore"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageImagePreview"
import useStyles from "./styles"
import Header from "./components/Header"
import useImageAction from "./hooks/useImageAction"
import "react-resizable/css/styles.css"
import ImagePreviewMain from "./components/ImagePreviewMain"

const ChatImagePreviewModal = observer(() => {
	const { previewInfo: info, open: open, message, ...rest } = MessageFilePreviewStore
	const { styles } = useStyles()

	const closeModel = useMemoizedFn(() => {
		MessageFilePreviewStore.setOpen(false)
		MessageFilePreviewService.clearPreviewInfo()
	})

	const {
		draggleRef,
		loading,
		bounds,
		disabled,
		onDownload,
		navigateToMessage,
		onMouseOver,
		onMouseOut,
		onStart,
		onHighDefinition,
	} = useImageAction(info)

	const header = useMemo(() => {
		return (
			<Header
				info={info}
				loading={loading}
				message={message}
				onDownload={onDownload}
				onMouseOut={onMouseOut}
				onMouseOver={onMouseOver}
				onHighDefinition={onHighDefinition}
				navigateToMessage={navigateToMessage}
			/>
		)
	}, [
		info,
		loading,
		message,
		onDownload,
		onMouseOut,
		onMouseOver,
		onHighDefinition,
		navigateToMessage,
	])

	const [bodySize, setBodySize] = useState({
		width: 800,
		height: 540,
	})

	const onResize = useMemoizedFn((_, { size }: ResizeCallbackData) => {
		setBodySize(size)
	})

	return (
		<Modal
			open={open}
			maskClosable={false}
			mask={false}
			onCancel={closeModel}
			onOk={closeModel}
			width="fit-content"
			wrapClassName={styles.wrapper}
			title={header}
			classNames={{
				content: styles.content,
				body: styles.body,
			}}
			centered
			footer={null}
			modalRender={(modal) => (
				<Draggable
					disabled={disabled}
					bounds={bounds}
					nodeRef={draggleRef}
					onStart={onStart}
				>
					<div ref={draggleRef}>{modal}</div>
				</Draggable>
			)}
			{...rest}
		>
			<ResizableBox
				className={styles.resizableContainer}
				width={bodySize.width}
				height={bodySize.height}
				minConstraints={[600, 400]}
				onResize={onResize}
			>
				<ImagePreviewMain info={info} containerClassName={styles.imagePreview} />
			</ResizableBox>
		</Modal>
	)
})

export default ChatImagePreviewModal
