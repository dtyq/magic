import type { ComponentType } from "react"
import { observer } from "mobx-react-lite"
import { IconGitBranch, IconLoader2 } from "@tabler/icons-react"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useTranslation } from "react-i18next"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { useMemoizedFn, useRequest } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { lazy, memo, Suspense, useMemo, useState } from "react"
import { MessageStatus, MessageUsageType, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { Button, MenuProps } from "antd"
import { splitNumber } from "@/utils/number"
import { Ellipsis } from "lucide-react"
import { MagicDropdown, MagicTooltip } from "@/components/base"
import { StatusBadge } from "./components/StatusBadge"
import { useGlobalSuggestion } from "@/components/settings/FollowUpSuggestionItems/hooks"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import ModelIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"

const SuggestList = lazy(() => import("./components/SuggestList"))

const enum MenuKey {
	/** This round's points consumption */
	ConsumptionPoints = "consumptionPoints",
}

const statusList = new Set(["error", "suspended", "finished"])

export function withAssistantCard<
	T extends {
		node: any
		selectedTopic: Topic | null
		classNames?: {
			card?: string
		}
		checkIsLastMessage?: (messageId: string) => boolean
	},
>(WrapperComponent: ComponentType<T>) {
	const targetComponent = observer((props: T) => {
		const { node, selectedTopic, classNames, checkIsLastMessage } = props
		const messageNode = superMagicStore.getMessageNode(node?.app_message_id)
		const { t } = useTranslation("super")
		const { isShareRoute, isMagicShareRoute } = useShareRoute()
		const {
			allowConversationCopy,
			onTopicSwitch,
			showTaskCompletedBadge = true,
		} = useMessageListContext()
		const { followUpSuggestions, keepUsedFollowUpSuggestions, setFollowUpSuggestions } =
			useGlobalSuggestion()

		// 评分状态：null=未评分, 'like'=好评, 'dislike'=差评
		const [rating, setRating] = useState<"like" | "dislike" | null>(null)

		const { loading: copyLoading, runAsync } = useRequest(SuperMagicApi.copyTopicFromMessage, {
			manual: true,
		})

		/** Points consumed in this conversation round */
		const roundConsumptionPoints = useMemo(() => {
			if (
				messageNode?.status === "finished" &&
				messageNode?.usage?.type === MessageUsageType.TaskPoints
			) {
				return messageNode?.usage?.detail?.consume ?? 0
			}
			return 0
		}, [messageNode])

		/** Model info from the user message of this round */
		const roundModels = useMemo(() => {
			const topicId = selectedTopic?.chat_topic_id
			if (!topicId) return []
			const messages = superMagicStore.messages.get(topicId)
			if (!messages || messages.length === 0) return []

			// 找到当前消息在列表中的位置
			const currentIdx = messages.findIndex((m) => m.app_message_id === node?.app_message_id)
			if (currentIdx < 0) return []

			// 从当前消息往前找最近一条 user 消息
			let userNode: any = null
			for (let i = currentIdx - 1; i >= 0; i--) {
				if (messages[i].role === "user") {
					userNode = superMagicStore.getMessageNode(messages[i].app_message_id)
					break
				}
			}
			if (!userNode) return []

			const superAgent = userNode?.extra?.super_agent
			if (!superAgent) return []

			const mode = selectedTopic?.topic_mode || ""
			const agentCode = selectedTopic?.agent_code

			const result: { modelItem: ModelItem | null; modelId: string }[] = []

			const resolveModel = (
				modelData:
					| { model_id?: string; model_name?: string; model_icon?: string }
					| undefined,
				getModelList: () => ModelItem[],
			) => {
				if (!modelData?.model_id) return
				const modelId = modelData.model_id
				// 如果消息中已有 model_icon 和 model_name，直接使用，无需匹配
				if (modelData.model_icon && modelData.model_name) {
					result.push({
						modelItem: {
							model_icon: modelData.model_icon,
							model_name: modelData.model_name,
							model_id: modelId,
						} as ModelItem,
						modelId,
					})
				} else {
					// 没有 model_icon/model_name，尝试匹配；匹配不上则不显示
					const found = getModelList().find((m) => m.model_id === modelId)
					if (found) {
						result.push({ modelItem: found, modelId })
					}
				}
			}

			// 语言模型
			resolveModel(superAgent.model, () =>
				superMagicModeService.getModelListByMode(mode, agentCode),
			)

			// 图像模型
			resolveModel(superAgent.image_model, () =>
				superMagicModeService.getImageModelListByMode(mode, agentCode),
			)

			// 视频模型
			resolveModel(superAgent.video_model, () =>
				superMagicModeService.getVideoModelListByMode(mode, agentCode),
			)

			return result
		}, [selectedTopic?.id, node?.app_message_id])

		const items = useMemo<MenuProps["items"]>(() => {
			return [
				{
					key: MenuKey.ConsumptionPoints,
					label: (
						<div className="flex w-full cursor-default items-center rounded text-[10px] font-normal text-foreground">
							<span>
								{t("ui.consumptionPoints", {
									points: splitNumber(roundConsumptionPoints),
								})}
							</span>
							{roundModels.length > 0 && (
								<>
									<span className="font-normal text-foreground">
										，{t("ui.usedModel")}
									</span>
									<span className="inline-flex items-center gap-1">
										{roundModels.map((item, idx) => (
											<span
												key={item.modelId}
												className="inline-flex items-center gap-1"
											>
												{idx > 0 && (
													<span className="text-muted-foreground">/</span>
												)}
												<MagicTooltip
													title={
														<span>
															{item.modelItem?.model_name ||
																item.modelId}
														</span>
													}
												>
													<span className="inline-flex items-center">
														{item.modelItem ? (
															<ModelIcon
																model={item.modelItem}
																size={14}
															/>
														) : (
															<span>{item.modelId}</span>
														)}
													</span>
												</MagicTooltip>
											</span>
										))}
									</span>
								</>
							)}
						</div>
					),
					visible: true,
				},
			].filter((o) => o.visible)
		}, [t, roundConsumptionPoints, roundModels])

		const triggerCopyTopic = useMemoizedFn(async () => {
			if (copyLoading) return
			if (selectedTopic) {
				try {
					const result = await runAsync({
						topicId: selectedTopic?.id,
						topicName: `${selectedTopic?.topic_name}_${t("common.copy")}`,
						messageId: messageNode.message_id,
					})

					if (result.status === "completed" && result?.topic)
						onTopicSwitch?.(result.topic)
				} catch (error) {
					console.error(error)
				}
			}
		})

		const handleLike = useMemoizedFn(() => {
			if (rating === "like") {
				setRating(null)
			} else {
				setRating("like")
				// TODO: 调用 API
			}
		})

		const handleDislike = useMemoizedFn(() => {
			if (rating === "dislike") {
				setRating(null)
			} else {
				setRating("dislike")
				// TODO: 调用 API
			}
		})

		const isRevokedMessage = node?.status === MessageStatus.REVOKED

		const isLastMessage = checkIsLastMessage?.(
			node?.app_message_id || messageNode?.message_id || "",
		)

		const baseShowSuggestCondition = useMemo(
			() =>
				!isShareRoute &&
				!isMagicShareRoute &&
				messageNode.status === "finished" &&
				!isRevokedMessage,
			[isRevokedMessage, messageNode.status, isShareRoute, isMagicShareRoute],
		)

		const showSuggestList = useMemo(
			() =>
				baseShowSuggestCondition &&
				followUpSuggestions &&
				(keepUsedFollowUpSuggestions || isLastMessage),
			[
				baseShowSuggestCondition,
				followUpSuggestions,
				isLastMessage,
				keepUsedFollowUpSuggestions,
			],
		)

		const showFollowUpDisabledHint = useMemo(
			() => baseShowSuggestCondition && !followUpSuggestions && isLastMessage,
			[baseShowSuggestCondition, followUpSuggestions, isLastMessage],
		)

		return (
			<>
				<WrapperComponent {...props} />

				{statusList.has(messageNode?.status) && (
					<>
						<StatusBadge status={messageNode?.status} />
						{messageNode?.status === "finished" && (
							<div className="mt-[6px] flex items-center justify-between gap-[4px]">
								<div className="flex items-center gap-1"></div>

								<div className="flex items-center gap-1">
									{allowConversationCopy && (
										<span
											className="inline-flex h-6 cursor-pointer items-center rounded-lg border border-border bg-background px-2 py-0 text-xs leading-4 text-foreground hover:bg-muted hover:text-foreground"
											onClick={triggerCopyTopic}
										>
											{copyLoading ? (
												<div className="flex h-[14px] w-[14px] items-center justify-center rounded-[8px] bg-black/[0.09] dark:bg-white/[0.09] [&_svg]:h-[60%] [&_svg]:w-[60%] [&_svg]:flex-none [&_svg]:animate-spin">
													<IconLoader2 size={12} />
												</div>
											) : (
												<IconGitBranch size={16} />
											)}
											<span>{t("ui.copyTopic")}</span>
										</span>
									)}
									{roundConsumptionPoints > 0 && (
										<MagicDropdown menu={{ items }} trigger={["click"]}>
											<Button className="!flex h-6 w-6 flex-none cursor-pointer items-center justify-center gap-1 !rounded-md !border !border-border !bg-white !p-0 !text-xs !font-normal !leading-4 !shadow-sm hover:!bg-fill hover:!text-foreground dark:!bg-card dark:hover:!bg-fill">
												<Ellipsis size={16} className="text-foreground" />
											</Button>
										</MagicDropdown>
									)}
								</div>
							</div>
						)}
					</>
				)}
				{showSuggestList && (
					<Suspense fallback={null}>
						<SuggestList
							messageId={node?.app_message_id}
							taskId={messageNode.task_id}
							topicId={selectedTopic?.id}
							showCloseAction={isLastMessage}
							closeSuggestions={() => setFollowUpSuggestions(false)}
						/>
					</Suspense>
				)}
				{showFollowUpDisabledHint && (
					<div
						className="mt-2 text-xs text-muted-foreground"
						data-testid="follow-up-suggestions-disabled-hint"
					>
						<span>{t("ui.followUpSuggestionsDisabledStatus")}</span>
						<span className="mx-1.5">·</span>
						<button
							type="button"
							className="underline underline-offset-2 hover:text-foreground"
							onClick={() => setFollowUpSuggestions(true)}
						>
							{t("ui.followUpSuggestionsReenable")}
						</button>
					</div>
				)}
			</>
		)
	})

	return memo(targetComponent)
}
