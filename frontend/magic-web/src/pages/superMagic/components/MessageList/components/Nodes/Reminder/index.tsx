import RichTextComponent from "../../Text/components/RichText"
import type { NodeProps } from "../types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useMemoizedFn } from "ahooks"
import { memo } from "react"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import { observer } from "mobx-react-lite"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"

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
	const { t } = useTranslation("super")
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)

	const onFileClick = useMemoizedFn((_: string, item?: TiptapMentionAttributes) => {
		const result = handleProjectFileMention(item?.data as ProjectFileMentionData, t)
		openMessageFile(result)

		onSelectDetail?.(result)
	})

	return (
		<div className={styles.node}>
			<RichTextComponent content={node?.content} onFileClick={onFileClick} />
		</div>
	)
}
export default memo(observer(Reminder))
