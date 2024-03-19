import { observer } from "mobx-react-lite"
import { userStore } from "@/opensource/models/user"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"
import TypewriterText from "./TypewriterText"
import { PORTAL_IDS } from "@/opensource/constants/portal"
import { cn } from "@/opensource/lib/utils"

function MessageListFallback({ className }: { className?: string }) {
	const { t } = useTranslation("super")
	const { userInfo } = userStore.user

	const userName = userInfo?.nickname || userInfo?.user_id || ""

	const GreetingIcon = useMemo(() => {
		return (
			<span className="flex-shrink-0 animate-[shake_0.5s_ease-in-out] text-[28px] leading-10">
				👋
			</span>
		)
	}, [])

	const greetingText = useMemo(
		() => t("superMagicMessageListFallback.greeting", { userName }),
		[t, userName],
	)

	return (
		<div
			className={cn(
				"mx-auto box-border flex w-full max-w-3xl flex-1 flex-col justify-center gap-2.5 px-8 py-5",
				className,
			)}
		>
			{/* Greeting Section */}
			<div className="flex items-center gap-2.5 text-[rgba(28,29,35,0.8)] dark:text-[rgba(255,255,255,0.8)]">
				{GreetingIcon}
				<TypewriterText
					text={greetingText}
					className="text-xl font-semibold leading-7 text-[rgba(28,29,35,0.8)] dark:text-[rgba(255,255,255,0.8)]"
					speed={50}
					punctuationDelay={800}
				/>
			</div>

			{/* Description */}
			<p className="w-full min-w-0 whitespace-pre-wrap text-sm font-normal leading-5 text-[rgba(28,29,35,0.8)] dark:text-[rgba(255,255,255,0.8)]">
				{t("superMagicMessageListFallback.description")}
			</p>

			{/* Topic Example Cards Portal Target */}
			<div id={PORTAL_IDS.SUPER_MAGIC_MESSAGE_LIST_FALLBACK_TOPIC_EXAMPLES} />

			<style>{`
				@keyframes shake {
					0% { transform: rotate(-10deg); }
					25% { transform: rotate(10deg); }
					50% { transform: rotate(0deg); }
					75% { transform: rotate(-10deg); }
					100% { transform: rotate(-10deg); }
				}
			`}</style>
		</div>
	)
}

export default observer(MessageListFallback)
