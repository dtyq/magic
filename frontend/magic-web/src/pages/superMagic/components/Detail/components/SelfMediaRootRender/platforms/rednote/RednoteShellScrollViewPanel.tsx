import type { MutableRefObject } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import type { CardFrameRef } from "../../components/CardFrame"
import { useSelfMediaStore } from "../../stores"
import { RednoteScrollView } from "./detail"
import { RednoteShellContentGate } from "./RednoteShellContentGate"
import type { SelfMediaAttachmentNode } from "../../types"

export interface RednoteShellScrollViewPanelProps {
	shouldRender: boolean
	isActive: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	allowEdit?: boolean
	cardRefs: MutableRefObject<Array<Array<CardFrameRef | null>>>
	onAddCardToCurrentChat?: (cardIndex: number) => void
	onAddActivePostDirectoryToCurrentChat?: () => void
}

export const RednoteShellScrollViewPanel = observer(function RednoteShellScrollViewPanel(
	props: RednoteShellScrollViewPanelProps,
) {
	const {
		shouldRender,
		isActive,
		attachmentList,
		allowEdit = false,
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
			<div className="flex h-full justify-center overflow-y-auto py-4">
				<div className="w-full max-w-[500px]">
					<RednoteShellContentGate
						loading={loading}
						error={error}
						hasPost={Boolean(activePost)}
					>
						{activePost ? (
							<RednoteScrollView
								attachmentList={attachmentList}
								allowEdit={allowEdit}
								cardRefs={cardRefs}
								postIndex={activePostIndex}
								onAddCardToCurrentChat={onAddCardToCurrentChat}
								onAddActivePostDirectoryToCurrentChat={
									onAddActivePostDirectoryToCurrentChat
								}
							/>
						) : null}
					</RednoteShellContentGate>
				</div>
			</div>
		</div>
	)
})
