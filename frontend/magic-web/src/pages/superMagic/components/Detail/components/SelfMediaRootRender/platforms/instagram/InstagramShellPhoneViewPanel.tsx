import type { MutableRefObject } from "react"
import { useState } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import type { CardFrameRef } from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import PhoneShell from "../../components/PhoneShell"
import { useSelfMediaStore } from "../../stores"
import {
	InstagramDetailView,
	InstagramFeedView,
	InstagramFooterView,
	type InstagramFooterLabels,
} from "./InstagramPhoneViews"
import { InstagramShellContentGate } from "./InstagramShellContentGate"
import { INSTAGRAM_PHONE_HEIGHT, INSTAGRAM_PHONE_WIDTH } from "./instagramShellConstants"
import type { SelfMediaAttachmentNode, SelfMediaPost } from "../../types"

export interface InstagramShellPhoneViewPanelProps {
	visible: boolean
	scale: number
	posts: SelfMediaPost[]
	activePostIndex: number
	shouldRenderFeed: boolean
	shouldRenderDetail: boolean
	shouldShowFooter: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	allowEdit?: boolean
	cardRefs: MutableRefObject<Array<Array<CardFrameRef | null>>>
	footerLabels: InstagramFooterLabels
	onBackHome: () => void
	onSelectFeedPost: (index: number) => void
	onEnsurePostLoaded?: (index: number) => Promise<SelfMediaPost | null>
	onChangeDetailCard: (index: number) => void
	onAddFeedCardToCurrentChat?: (postIndex: number) => void
	onAddDetailCardToCurrentChat?: (cardIndex: number) => void
	onAddActivePostDirectoryToCurrentChat?: () => void
	onGoToEdit?: () => void
}

export const InstagramShellPhoneViewPanel = observer(function InstagramShellPhoneViewPanel(
	props: InstagramShellPhoneViewPanelProps,
) {
	const {
		visible,
		scale,
		posts,
		activePostIndex,
		shouldRenderFeed,
		shouldRenderDetail,
		shouldShowFooter,
		attachmentList,
		allowEdit,
		cardRefs,
		footerLabels,
		onBackHome,
		onSelectFeedPost,
		onEnsurePostLoaded,
		onChangeDetailCard,
		onAddFeedCardToCurrentChat,
		onAddDetailCardToCurrentChat,
		onAddActivePostDirectoryToCurrentChat,
		onGoToEdit,
	} = props
	const store = useSelfMediaStore()
	const { loading, error, view, activePost, activeCardIndex } = store

	const [activeCardExternalRefreshVersion, setActiveCardExternalRefreshVersion] = useState(0)
	// Gap from visual phone right edge (transform scale, center origin)
	const phoneShellLayoutWidth = INSTAGRAM_PHONE_WIDTH + 28
	const actionStripMarginLeft = Math.round(8 + (phoneShellLayoutWidth * (scale - 1)) / 2)

	return (
		<div
			className={cn("absolute inset-0", visible ? "block" : "hidden")}
			aria-hidden={!visible}
		>
			<div className="flex h-full items-center justify-center py-4">
				<div className="flex items-start">
					<PhoneShell
						scale={scale}
						width={INSTAGRAM_PHONE_WIDTH}
						height={INSTAGRAM_PHONE_HEIGHT}
						innerClassName="bg-white"
						theme="dark"
					>
						<div className="flex h-full flex-col bg-white pt-[54px] text-[#262626]">
							<div className="relative flex-1 overflow-hidden">
								<InstagramShellContentGate
									loading={loading}
									error={error}
									hasPost={Boolean(activePost)}
								>
									{activePost ? (
										<>
											{shouldRenderFeed ? (
												<div
													className={cn(
														"absolute inset-0",
														view === "feed" ? "block" : "hidden",
													)}
													aria-hidden={view !== "feed"}
												>
													<InstagramFeedView
														posts={posts}
														attachmentList={attachmentList}
														onSelectPost={onSelectFeedPost}
														onEnsurePostLoaded={onEnsurePostLoaded}
														onAddCardToCurrentChat={
															onAddFeedCardToCurrentChat
														}
													/>
												</div>
											) : null}
											{shouldRenderDetail ? (
												<div
													className={cn(
														"absolute inset-0",
														view === "detail" ? "block" : "hidden",
													)}
													aria-hidden={view !== "detail"}
												>
													<InstagramDetailView
														post={activePost}
														cardIndex={activeCardIndex}
														attachmentList={attachmentList}
														cardRefs={cardRefs}
														postIndex={activePostIndex}
														onBackHome={onBackHome}
														backLabel={footerLabels.home}
														onChangeCard={onChangeDetailCard}
														onAddCardToCurrentChat={
															onAddDetailCardToCurrentChat
														}
														activeCardExternalRefreshVersion={
															activeCardExternalRefreshVersion
														}
													/>
												</div>
											) : null}
										</>
									) : null}
								</InstagramShellContentGate>
							</div>
							{shouldShowFooter ? (
								<InstagramFooterView labels={footerLabels} />
							) : null}
						</div>
					</PhoneShell>
					{/* Action strip: to the right of phone, follows layout + scale */}
					{view === "detail" && activePost && (
						<CardActionStrip
							className="mt-6 shrink-0"
							style={{ marginLeft: actionStripMarginLeft }}
							allowEdit={allowEdit}
							onAddToCurrentChat={
								onAddDetailCardToCurrentChat
									? () => onAddDetailCardToCurrentChat(activeCardIndex)
									: undefined
							}
							onGoToEdit={onGoToEdit}
							onAddPostFolderToCurrentChat={onAddActivePostDirectoryToCurrentChat}
							onRefresh={() => {
								setActiveCardExternalRefreshVersion((v) => v + 1)
							}}
							testIdPrefix="ig-detail-strip"
							fileId={activePost?.cards[activeCardIndex]?.fileId}
							attachmentList={attachmentList}
						/>
					)}
				</div>
			</div>
		</div>
	)
})
