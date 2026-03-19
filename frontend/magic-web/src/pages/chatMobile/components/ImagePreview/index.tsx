import { Popup } from "antd-mobile"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import MessageFilePreviewStore from "@/stores/chatNew/messagePreview/ImagePreviewStore"
import MessageFilePreviewService from "@/services/chat/message/MessageFilePreview"
import ImageViewer from "./components/ImageViewer/index"
import ActionBar from "./components/ActionBar/index"
import useImagePreview from "./hooks/useImagePreview"
import useBackHandler from "@/utils/historyStackManager/hooks"
import { useStyles } from "./styles"

const ImagePreview = observer(() => {
	const { open, previewInfo } = MessageFilePreviewStore
	const { styles } = useStyles()

	const { loading, progress, currentImage, onDownload, onHighDefinition, navigateToMessage } =
		useImagePreview(previewInfo)

	const onClose = useMemoizedFn(() => {
		MessageFilePreviewStore.setOpen(false)
		MessageFilePreviewService.clearPreviewInfo()
	})

	// Handle mobile back button with safe history stack management
	const { cleanup } = useBackHandler(open, onClose, "ImagePreview")

	// Manual cleanup on unmount if needed
	const handlePopupClose = useMemoizedFn(() => {
		onClose()
		// Ensure cleanup is called when popup is closed by other means
		cleanup()
	})

	return (
		<Popup
			visible={open}
			onClose={handlePopupClose}
			bodyClassName={styles.popupBody}
			position="bottom"
			destroyOnClose={false}
			bodyStyle={{
				animation: open ? "fadeIn 0.3s ease-in-out" : "fadeOut 0.3s ease-in-out",
			}}
			mask={false}
		>
			<ImageViewer
				src={currentImage}
				loading={loading}
				progress={progress}
				onClose={handlePopupClose}
				info={previewInfo}
				renderActionBar={() => (
					<ActionBar
						info={previewInfo}
						loading={loading}
						onDownload={onDownload}
						onHighDefinition={onHighDefinition}
						navigateToMessage={navigateToMessage}
					/>
				)}
			/>
		</Popup>
	)
})

export default memo(ImagePreview)
