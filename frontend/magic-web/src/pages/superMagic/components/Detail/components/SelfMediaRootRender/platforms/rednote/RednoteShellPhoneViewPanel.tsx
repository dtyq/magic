import type { CSSProperties, MutableRefObject } from "react"
import { useCallback, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/utils/cn"
import type { CardFrameRef } from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import PhoneShell from "../../components/PhoneShell"
import { useSelfMediaStore } from "../../stores"
import { RednoteDetailView, RednoteFooter } from "./detail"
import RednoteFeedView from "./feed"
import { RednoteShellContentGate } from "./RednoteShellContentGate"
import { REDNOTE_PHONE_HEIGHT, REDNOTE_PHONE_WIDTH } from "./rednoteShellConstants"
import type { SelfMediaAttachmentNode, SelfMediaPostMetaPatch } from "../../types"

interface PhoneFocusPoint {
	xPercent: number
	yPercent: number
}

const DEFAULT_PHONE_FOCUS_POINT: PhoneFocusPoint = {
	xPercent: 50,
	yPercent: 38,
}

function clampFocusPercent(value: number) {
	return Math.max(6, Math.min(94, value))
}

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
	onUpdatePostMeta?: (patch: SelfMediaPostMetaPatch) => Promise<boolean>
	phoneFocused?: boolean
	focusDisabled?: boolean
	onPhoneFocus?: () => void
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
		onUpdatePostMeta,
		phoneFocused = false,
		focusDisabled = false,
		onPhoneFocus,
	} = props
	const store = useSelfMediaStore()
	const { loading, error, view, activePost, activeCardIndex } = store
	const isMobile = useIsMobile()
	const phoneFocusDisabled = focusDisabled || isMobile
	const effectivePhoneFocused = phoneFocused && !phoneFocusDisabled
	const [activeCardExternalRefreshVersion, setActiveCardExternalRefreshVersion] = useState(0)
	const focusClusterRef = useRef<HTMLDivElement>(null)
	const [phoneFocusPoint, setPhoneFocusPoint] =
		useState<PhoneFocusPoint>(DEFAULT_PHONE_FOCUS_POINT)
	const phoneShellLayoutWidth = REDNOTE_PHONE_WIDTH + 28
	const phoneShellLayoutHeight = REDNOTE_PHONE_HEIGHT + 28
	const actionStripMarginLeft = Math.round(8 + (phoneShellLayoutWidth * (scale - 1)) / 2)
	const actionStripMarginTop = Math.round((phoneShellLayoutHeight * (1 - scale)) / 2)
	const handlePhoneFocusFromEvent = useCallback(
		(event?: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
			if (phoneFocusDisabled) return
			if (view !== "detail") return
			if (phoneFocused) {
				onPhoneFocus?.()
				return
			}
			const rect = focusClusterRef.current?.getBoundingClientRect()
			if (
				rect &&
				rect.width > 0 &&
				rect.height > 0 &&
				event &&
				Number.isFinite(event.clientX) &&
				Number.isFinite(event.clientY)
			) {
				setPhoneFocusPoint({
					xPercent: clampFocusPercent(((event.clientX - rect.left) / rect.width) * 100),
					yPercent: clampFocusPercent(((event.clientY - rect.top) / rect.height) * 100),
				})
			} else {
				setPhoneFocusPoint(DEFAULT_PHONE_FOCUS_POINT)
			}
			onPhoneFocus?.()
		},
		[onPhoneFocus, phoneFocused, phoneFocusDisabled, view],
	)

	return (
		<div
			className={cn("absolute inset-0", visible ? "block" : "hidden")}
			aria-hidden={!visible}
			data-testid="rednote-phone-view-panel"
			data-focused={effectivePhoneFocused ? "true" : "false"}
			data-focus-x={phoneFocusPoint.xPercent.toFixed(2)}
			data-focus-y={phoneFocusPoint.yPercent.toFixed(2)}
		>
			<style>{`
				@keyframes self-media-phone-enter-from-right {
					0% {
						opacity: 0;
						transform: translate3d(72px, 0, 0) scale(0.985);
					}
					62% {
						opacity: 1;
						transform: translate3d(-10px, 0, 0) scale(1.006);
					}
					82% {
						transform: translate3d(4px, 0, 0) scale(0.998);
					}
					100% {
						opacity: 1;
						transform: translate3d(0, 0, 0) scale(1);
					}
				}
				.self-media-phone-enter {
					animation: self-media-phone-enter-from-right 560ms cubic-bezier(0.2, 1.18, 0.28, 1) both;
				}
				.self-media-phone-focus-cluster {
					transition:
						transform 430ms cubic-bezier(0.2, 1.2, 0.28, 1),
						filter 430ms ease;
					will-change: transform, filter;
				}
				.self-media-phone-focus-cluster[data-focused="true"] {
					position: relative;
					z-index: 20;
					transform-origin: var(--phone-focus-origin-x, 50%) var(--phone-focus-origin-y, 38%);
					transform: scale(1.24);
					filter: drop-shadow(0 42px 86px rgba(24, 24, 27, 0.22));
				}
				@media (prefers-reduced-motion: reduce) {
					.self-media-phone-enter,
					.self-media-phone-focus-cluster {
						animation: none !important;
						transform: none !important;
						transition: none !important;
						filter: none !important;
					}
					.self-media-phone-enter {
						opacity: 1 !important;
					}
				}
			`}</style>
			<div className="flex h-full items-center justify-center py-4">
				<div className={cn("flex items-start", visible && "self-media-phone-enter")}>
					<div
						ref={focusClusterRef}
						className="self-media-phone-focus-cluster flex items-start"
						data-focused={effectivePhoneFocused ? "true" : "false"}
						style={
							{
								"--phone-focus-origin-x": `${phoneFocusPoint.xPercent}%`,
								"--phone-focus-origin-y": `${phoneFocusPoint.yPercent}%`,
							} as CSSProperties
						}
					>
						<div
							className="shrink-0"
							data-testid="rednote-phone-focus-surface"
							onPointerDown={(event) => {
								event.stopPropagation()
								handlePhoneFocusFromEvent(event)
							}}
						>
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
																view === "feed"
																	? "block"
																	: "hidden",
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
																view === "detail"
																	? "block"
																	: "hidden",
															)}
															aria-hidden={view !== "detail"}
														>
															<RednoteDetailView
																attachmentList={attachmentList}
																cardRefs={cardRefs}
																onBackHome={onBackHome}
																backLabel={footerLabels.home}
																onChangeCard={onChangeDetailCard}
																allowEdit={allowEdit}
																onAddCardToCurrentChat={
																	onAddDetailCardToCurrentChat
																}
																onPreviewFocus={
																	handlePhoneFocusFromEvent
																}
																onUpdatePostMeta={onUpdatePostMeta}
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
									{shouldShowFooter ? (
										<RednoteFooter labels={footerLabels} />
									) : null}
								</div>
							</PhoneShell>
						</div>
						{view === "detail" && activePost && (
							<CardActionStrip
								className="shrink-0"
								style={{
									marginLeft: actionStripMarginLeft,
									marginTop: actionStripMarginTop,
								}}
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
		</div>
	)
})
