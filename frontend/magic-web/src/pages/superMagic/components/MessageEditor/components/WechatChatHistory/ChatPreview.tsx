import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { FileData } from "../../types"
import type { WechatChatSnapshot } from "../../extensions/wechat-chat-history/types"
import { useWechatChatTitle } from "./useWechatChatTitle"
import ChatMedia from "./ChatMedia"
import LinkCard from "./LinkCard"

export function ChatPreviewTitle({ participants }: { participants: string[] }) {
	return <h3 className="truncate text-sm font-medium">{useWechatChatTitle(participants)}</h3>
}

export default function ChatPreview({
	snapshot,
	files,
	onRetry,
}: {
	snapshot: WechatChatSnapshot
	files: FileData[]
	onRetry: (id: string) => void
}) {
	const { t } = useTranslation("super")
	return (
		<div className="space-y-5 px-5 py-4">
			{snapshot.unrecognized && (
				<p className="text-xs text-muted-foreground">{t("wechatChat.unrecognized")}</p>
			)}
			{snapshot.messages.map((message, index) => {
				const outgoing = snapshot.participants.indexOf(message.sender) === 1
				const previous = snapshot.messages[index - 1]
				return (
					<div key={message.id} data-chat-message={message.id}>
						{(!previous ||
							previous.date !== message.date ||
							previous.time !== message.time) && (
							<div className="pb-5 text-center text-xs text-muted-foreground">
								{message.date} {message.time}
							</div>
						)}
						<div
							className={cn("flex items-start gap-3", outgoing && "flex-row-reverse")}
						>
							<span
								aria-label={t("wechatChat.simulatedAvatar", {
									name: message.sender,
								})}
								className={cn(
									"grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-medium",
									outgoing
										? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
										: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
								)}
							>
								{message.sender.slice(0, 2)}
							</span>
							<div className="min-w-0 max-w-[80%] space-y-2">
								{snapshot.participants.length > 2 && (
									<p className="text-xs text-muted-foreground">
										{message.sender}
									</p>
								)}
								{message.mentions.length ? (
									message.mentions.map((attrs, number) => (
										<ChatMedia
											key={`${message.id}:${number}`}
											attrs={attrs}
											files={files}
											onRetry={onRetry}
										/>
									))
								) : message.kind === "link" && message.url ? (
									<LinkCard url={message.url} title={message.text} />
								) : message.kind === "image" ||
								  message.kind === "video" ||
								  message.kind === "file" ? (
									<div className="rounded-lg bg-muted p-4 text-sm">
										<p className="break-all">{message.text}</p>
										<p className="mt-2 text-xs text-muted-foreground">
											{message.mediaState === "markerOnly"
												? t("wechatChat.markerOnly")
												: message.mediaState === "prepareFailed"
													? t("wechatChat.prepareFailed")
													: message.mediaState === "unmatched"
														? t("wechatChat.unmatchedMedia")
														: t("wechatChat.unlinkedMedia")}
										</p>
									</div>
								) : (
									<div
										className={cn(
											"whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-6",
											outgoing
												? "bg-[#a9ed8a] text-neutral-900"
												: "bg-background text-foreground",
										)}
									>
										{message.text}
									</div>
								)}
								{message.mentions.length > 0 && message.text && (
									<p className="whitespace-pre-wrap text-xs text-muted-foreground">
										{message.text}
									</p>
								)}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
