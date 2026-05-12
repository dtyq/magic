import type { MutableRefObject } from "react"
import { useState } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import type { CardFrameRef } from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import PhoneShell from "../../components/PhoneShell"
import { useSelfMediaStore } from "../../stores"
import { RednoteDetailView, RednoteFooter } from "./detail"
import RednoteFeedView from "./feed"
import { RednoteShellContentGate } from "./RednoteShellContentGate"
import { REDNOTE_PHONE_HEIGHT, REDNOTE_PHONE_WIDTH } from "./rednoteShellConstants"
import type { SelfMediaAttachmentNode } from "../../types"

export interface RednoteFooterLabels {
	home: string
	shopping: string
	publish: string
	messages: string
	me: string
}

export interface RednoteShellPhoneViewPanelProps {
	visible: boolean
	scale: number
	shouldRenderFeed: boolean
	shouldRenderDetail: boolean
	shouldShowFooter: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	allowEdit?: boolean
	cardRefs: MutableRefObject<Array<Array<CardFrameRef | null>>>
	footerLabels: RednoteFooterLabels
	onBackHome: () => void
	onSelectFeedPost: (index: number) => void
	onChangeDetailCard: (index: number) => void
	onAddFeedCardToCurrentChat?: (postIndex: number) => void
	onAddDetailCardToCurrentChat?: (cardIndex: number) => void
	onAddActivePostDirectoryToCurrentChat?: () => void
}

export const RednoteShellPhoneViewPanel = observer(function RednoteShellPhoneViewPanel(
	props: RednoteShellPhoneViewPanelProps,
) {
	const {
		visible,
		scale,
		shouldRenderFeed,
		shouldRenderDetail,
		shouldShowFooter,
		attachmentList,
		allowEdit,
		cardRefs,
		footerLabels,
		onBackHome,
		onSelectFeedPost,
		onChangeDetailCard,
		onAddFeedCardToCurrentChat,
		onAddDetailCardToCurrentChat,
		onAddActivePostDirectoryToCurrentChat,
	} = props
	const store = useSelfMediaStore()
	const { loading, error, view, activePost, activeCardIndex } = store
	const [activeCardExternalRefreshVersion, setActiveCardExternalRefreshVersion] = useState(0)
	const phoneShellLayoutWidth = REDNOTE_PHONE_WIDTH + 28
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
						width={REDNOTE_PHONE_WIDTH}
						height={REDNOTE_PHONE_HEIGHT}
						theme="dark"
					>
						<div className="flex h-full flex-col bg-white pb-[20px] pt-[54px]">
							<div className="relative flex-1 overflow-hidden">
								<RednoteShellContentGate
									loading={loading}
									error={error}
									hasPost={Boolean(activePost)}
								>
									{activePost ? (
										<>
											{shouldRenderFeed ? (
												<div
													className={cn(
														"scrollbar-hide absolute inset-0 overflow-y-auto",
														view === "feed" ? "block" : "hidden",
													)}
													aria-hidden={view !== "feed"}
												>
													<RednoteFeedView
														attachmentList={attachmentList}
														onSelectPost={onSelectFeedPost}
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
													<RednoteDetailView
														attachmentList={attachmentList}
														cardRefs={cardRefs}
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
								</RednoteShellContentGate>
							</div>
							{shouldShowFooter ? <RednoteFooter labels={footerLabels} /> : null}
						</div>
					</PhoneShell>
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
							onAddPostFolderToCurrentChat={onAddActivePostDirectoryToCurrentChat}
							onGoToEdit={() => {
								store.setActiveCardIndex(activeCardIndex)
								store.setView("edit")
							}}
							onRefresh={() => {
								setActiveCardExternalRefreshVersion((v) => v + 1)
							}}
							fileId={activePost.cards[activeCardIndex]?.fileId}
							attachmentList={attachmentList}
							testIdPrefix="red-detail-strip"
						/>
					)}
				</div>
			</div>
		</div>
	)
})
