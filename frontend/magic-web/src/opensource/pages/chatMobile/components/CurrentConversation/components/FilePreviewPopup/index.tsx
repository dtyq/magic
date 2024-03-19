import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import ChatFilePreviewPanel from "@/opensource/pages/chatNew/components/ChatFilePreviewPanel"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/FilePreviewStore"
import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"

const useStyles = createStyles(({ css }) => ({
	popupBody: css`
		height: 80%;
	`,
}))

const FilePreviewPopup = observer(() => {
	const { styles } = useStyles()
	const { open, clearPreviewInfo } = MessageFilePreviewStore

	return (
		<MagicPopup
			visible={open}
			onClose={clearPreviewInfo}
			onMaskClick={clearPreviewInfo}
			bodyClassName={styles.popupBody}
		>
			<ChatFilePreviewPanel />
		</MagicPopup>
	)
})

export default FilePreviewPopup
