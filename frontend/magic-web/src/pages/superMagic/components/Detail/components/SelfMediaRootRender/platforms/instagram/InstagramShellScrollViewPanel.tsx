import type { MutableRefObject } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import type { CardFrameRef } from "../../components/CardFrame"
import { useSelfMediaStore } from "../../stores"
import { InstagramScrollView } from "./InstagramPhoneViews"
import { InstagramShellContentGate } from "./InstagramShellContentGate"
import type { SelfMediaAttachmentNode } from "../../types"

export interface InstagramShellScrollViewPanelProps {
	shouldRender: boolean
	isActive: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	allowEdit?: boolean
	cardRefs: MutableRefObject<Array<Array<CardFrameRef | null>>>
	onAddCardToCurrentChat?: (cardIndex: number) => void
	onAddActivePostDirectoryToCurrentChat?: () => void
}

export const InstagramShellScrollViewPanel = observer(function InstagramShellScrollViewPanel(
	props: InstagramShellScrollViewPanelProps,
) {
	const {
		shouldRender,
		isActive,
		attachmentList,
		allowEdit,
		cardRefs,
		onAddCardToCurrentChat,
		onAddActivePostDirectoryToCurrentChat,
	} = props
	const store = useSelfMediaStore()
	const { loading, error, activePost, activePostIndex } = store

	if (!shouldRender) return null

	return (
		<div
			className={cn("absolute inset-0", isActive ? "block" : "hidden")}
			aria-hidden={!isActive}
		>
			<div className="scrollbar-hide flex h-full justify-center overflow-y-auto bg-[#fafafa] py-4">
				<div className="w-full max-w-[500px]">
					<InstagramShellContentGate
						loading={loading}
						error={error}
						hasPost={Boolean(activePost)}
					>
						{activePost ? (
							<InstagramScrollView
								post={activePost}
								attachmentList={attachmentList}
								allowEdit={allowEdit}
								cardRefs={cardRefs}
								postIndex={activePostIndex}
								onAddCardToCurrentChat={onAddCardToCurrentChat}
							/>
						) : null}
					</InstagramShellContentGate>
				</div>
			</div>
		</div>
	)
})
