import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowUp, Mic, Upload } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { cn } from "@/lib/tiptap-utils"
import { JSONContent } from "@tiptap/core"
import { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"

interface ChatInputComponentProps {
	handleSendMsg: (content: JSONContent | string, options?: SendMessageOptions) => void
	showLoading: boolean
}

function ChatInputComponent({ handleSendMsg, showLoading }: ChatInputComponentProps) {
	const { t } = useTranslation("crew/create")
	const [value, setValue] = useState("")

	const canSend = value.trim().length > 0

	function handleSend() {
		if (!canSend) return
		setValue("")
	}

	return (
		<div className="shrink-0" data-testid="crew-topic-chat-input">
			<div className="rounded-2xl border border-border bg-sidebar p-2">
				<div className="rounded-xl border border-border bg-background p-2.5">
					<Textarea
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder={t("topic.inputPlaceholder")}
						className="h-20 min-h-16 resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
						data-testid="crew-topic-textarea"
					/>
					<div className="mt-2 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">{t("topic.inputHint")}</p>
						<div className="flex items-center gap-1">
							<Button
								variant="secondary"
								size="icon"
								className="shadow-xs size-8 rounded-md"
							>
								<Upload className="h-4 w-4" />
							</Button>
							<Button
								variant="secondary"
								size="icon"
								className="shadow-xs size-8 rounded-md"
							>
								<Mic className="h-4 w-4" />
							</Button>
							<Button
								size="icon"
								className={cn(
									"shadow-xs size-8 rounded-md",
									!canSend && "opacity-50",
								)}
								disabled={!canSend}
								onClick={handleSend}
								data-testid="crew-topic-send-button"
							>
								<ArrowUp className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const ChatInput = memo(ChatInputComponent)
