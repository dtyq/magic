import RichTextComponent from "../../Text/components/RichText"
import type { NodeProps } from "../types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useMemoizedFn } from "ahooks"
import { memo } from "react"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import pubsub from "@/utils/pubsub"
import { observer } from "mobx-react-lite"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => {
	return {
		node: css`
			width: 100%;

			& p {
				margin-bottom: 0;
			}
		`,
	}
})

function Reminder(props: NodeProps) {
	const { isShare, onSelectDetail } = props

	const { styles } = useStyles()
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)

	const onFileClick = useMemoizedFn((_: string, item?: TiptapMentionAttributes) => {
		const result = handleProjectFileMention(item?.data as ProjectFileMentionData, t)
		pubsub.publish("super_magic_switch_detail_mode", "files")

		// 发布文件选择事件，传递文件信息用于打开对应的tab
		// 根据MessageAttachment传递的数据结构，file_id可能在detail.data.file_id或detail.currentFileId中
		const fileId =
			result?.data?.file_id || result?.currentFileId || result?.file_id || result?.id
		if (result && fileId) {
			pubsub.publish("super_magic_open_file_tab", {
				fileId,
				fileData: result,
			})
		}

		onSelectDetail?.(result)
	})

	return (
		<div className={styles.node}>
			<RichTextComponent content={node?.content} onFileClick={onFileClick} />
		</div>
	)
}
export default memo(observer(Reminder))
