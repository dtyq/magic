import type { ComponentType } from "react"
import { observer } from "mobx-react-lite"
import { IconGitBranch, IconInfoCircle, IconLoader2 } from "@tabler/icons-react"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useTranslation } from "react-i18next"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { useMemoizedFn, useRequest } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { lazy, memo, Suspense, useMemo, useState } from "react"
import { MessageStatus, MessageUsageType, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { Button, Flex, MenuProps } from "antd"
import { splitNumber } from "@/utils/number"
import { Ellipsis } from "lucide-react"
import { MagicDropdown } from "@/components/base"
import { StatusBadge } from "./components/StatusBadge"
import { useGlobalSuggestion } from "@/components/settings/FollowUpSuggestionItems/hooks"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"

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

		const items = useMemo<MenuProps["items"]>(() => {
			return [
				{
					key: MenuKey.ConsumptionPoints,
					label: (
						<div className="flex w-full cursor-default items-center gap-1 rounded text-[10px] font-normal text-muted-foreground">
							<IconInfoCircle size={16} className="text-foreground" />
							<Flex align="center" gap={2} className="text-foreground">
								<div>{t("ui.consumptionPoints1")}</div>
								<div className="px-1 font-semibold">
									{splitNumber(roundConsumptionPoints)}
								</div>
								<div>{t("ui.consumptionPoints2")}</div>
							</Flex>
						</div>
					),
					visible: true,
				},
			].filter((o) => o.visible)
		}, [t, roundConsumptionPoints])

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
