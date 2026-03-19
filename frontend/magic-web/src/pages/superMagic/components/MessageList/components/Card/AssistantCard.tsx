import type { ComponentType } from "react"
import { observer } from "mobx-react-lite"
import { IconBan, IconGitBranch, IconInfoCircle, IconLoader2 } from "@tabler/icons-react"
import BaseRichText from "@/pages/superMagic/components/MessageList/components/Text/components/RichText"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useTranslation } from "react-i18next"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { useMemoizedFn, useRequest } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { memo, useMemo, useState } from "react"
import { MessageUsageType, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { Button, Flex, MenuProps } from "antd"
import { splitNumber } from "@/utils/number"
import { Check, Ellipsis, Hand, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { MagicDropdown } from "@/components/base"

const enum MenuKey {
	/** This round's points consumption */
	ConsumptionPoints = "consumptionPoints",
}

/** Base styles shared by all status badge boxes */
const boxBase = "rounded-[12px] inline-flex px-2 py-1 items-center text-xs gap-1 [&_p]:mb-0"

export function withAssistantCard<
	T extends {
		node: any
		selectedTopic: Topic | null
		classNames?: {
			card?: string
		}
	},
>(WrapperComponent: ComponentType<T>) {
	const targetComponent = observer((props: T) => {
		const { node, selectedTopic, classNames } = props
		const messageNode = superMagicStore.getMessageNode(node?.app_message_id)

		const { t } = useTranslation("super")
		const { allowConversationCopy, onTopicSwitch } = useMessageListContext()

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

		return (
			<div className="w-full" data-id={node?.app_message_id}>
				<div
					className={cn(
						"relative w-full pl-6",
						"after:absolute after:left-[11px] after:top-0 after:h-full after:w-px after:border-l after:border-dashed after:border-border after:content-['']",
						classNames?.card,
					)}
				>
					<WrapperComponent {...props} />
				</div>
				{messageNode.status === "error" && (
					<div className="py-3">
						<span
							className={cn(
								boxBase,
								"bg-amber-50 text-amber-500 [&_p]:!text-amber-500",
								"dark:bg-amber-500/10 dark:text-amber-400 dark:[&_p]:!text-amber-400",
							)}
						>
							<IconBan stroke={2} size={16} />
							<BaseRichText content={t("ui.taskError")} />
						</span>
					</div>
				)}
				{messageNode.status === "suspended" && (
					<div className="py-3">
						<span
							className={cn(
								boxBase,
								"rounded-full bg-[#f5f6f7] text-gray-400",
								"[&_p]:!text-xs [&_p]:!leading-4 [&_p]:!text-gray-400 [&_svg]:text-gray-400",
								"dark:bg-white/10 dark:text-gray-500 dark:[&_p]:!text-gray-500 dark:[&_svg]:text-gray-500",
							)}
						>
							<Hand strokeWidth={2} size={12} />
							<BaseRichText content={t("ui.taskSuspended")} />
						</span>
					</div>
				)}
				{messageNode.status === "finished" && (
					<div className="py-3">
						<span
							className={cn(
								boxBase,
								"rounded-full bg-[#ebf2fe] text-blue-500",
								"[&_p]:!text-xs [&_p]:!leading-4 [&_p]:!text-blue-500",
								"dark:bg-blue-500/10 dark:text-blue-400 dark:[&_p]:!text-blue-400",
							)}
						>
							<Check strokeWidth={2} size={12} />
							<BaseRichText content={t("ui.taskCompleted")} />
						</span>
						<div className="mt-[6px] flex items-center justify-between gap-[4px]">
							<div className="flex items-center gap-1">
								{/* <button
									type="button"
									className={cn(
										"flex size-6 items-center justify-center rounded-lg transition-all duration-200",
										rating === "like"
											? "text-green-500 hover:text-green-600"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
									onClick={handleLike}
									disabled={rating === "dislike"}
									style={{
										opacity: rating === "dislike" ? 0.5 : 1,
										pointerEvents: rating === "dislike" ? "none" : "auto",
									}}
								>
									<ThumbsUp
										size={16}
										fill={rating === "like" ? "currentColor" : "none"}
										className="transition-all duration-200"
										style={{
											transform:
												rating === "like" ? "scale(1.1)" : "scale(1)",
										}}
									/>
								</button>
								<button
									type="button"
									className={cn(
										"flex size-6 items-center justify-center rounded-lg transition-all duration-200",
										rating === "dislike"
											? "text-orange-500 hover:text-orange-600"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
									onClick={handleDislike}
									disabled={rating === "like"}
									style={{
										opacity: rating === "like" ? 0.5 : 1,
										pointerEvents: rating === "like" ? "none" : "auto",
									}}
								>
									<ThumbsDown
										size={16}
										fill={rating === "dislike" ? "currentColor" : "none"}
										className="transition-all duration-200"
										style={{
											transform:
												rating === "dislike" ? "scale(1.1)" : "scale(1)",
										}}
									/>
								</button> */}
							</div>

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
					</div>
				)}
			</div>
		)
	})

	return memo(targetComponent)
}
