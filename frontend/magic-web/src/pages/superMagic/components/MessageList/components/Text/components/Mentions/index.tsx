import FlexBox from "@/components/base/FlexBox"
import {
	getMentionUniqueId,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import AtItem from "@/pages/superMagic/components/MessageEditor/components/AtItem"
import { memo } from "react"
import { MentionItemType, ProjectFileMentionData } from "@/components/business/MentionPanel/types"

const Mentions = ({
	data,
	onFileClick,
	className,
}: {
	data: any
	onFileClick?: (fileId: string, item: TiptapMentionAttributes) => void
	className?: string
}) => {
	const mentions =
		data?.[data?.type]?.extra?.super_agent?.mentions ||
		data.raw_content?.[data.raw_content.type]?.extra?.super_agent?.mentions

	if (!mentions || mentions.length === 0) return null

	return (
		<FlexBox gap={4} wrap align="center" className={className}>
			{mentions?.map((mention: any, index: number) => (
				<AtItem
					data={mention.attrs}
					key={`${getMentionUniqueId(mention.attrs)}-${index}`}
					onFileClick={
						onFileClick
							? (item) =>
									onFileClick((item as ProjectFileMentionData).file_id, {
										type: MentionItemType.PROJECT_FILE,
										data: item,
									} as TiptapMentionAttributes)
							: undefined
					}
				/>
			))}
		</FlexBox>
	)
}

export default memo(Mentions)
