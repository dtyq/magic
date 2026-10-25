import { useMemo, type PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useMessageListContext } from "../../context"
import { globalConfigStore } from "@/stores/globalConfig"
import { getAvatarUrl } from "@/utils/avatar"
import dayjs from "@/infrastructure/vendors/dayjs"
import { cn } from "@/utils/cn"

export const AssistantMessageHeader = observer(function AssistantMessageHeader({
	sendTime,
	classNames,
	children,
}: PropsWithChildren<{ sendTime?: number; classNames?: { header?: string; icon?: string } }>) {
	const { t } = useTranslation("super")
	const { renderAssistantAvatar } = useMessageListContext()

	const globalConfig = globalConfigStore.globalConfig
	const avatarUrl = globalConfig?.minimal_logo || ""

	// Format send time as "MM/DD HH:mm"
	const formattedTime = useMemo(() => {
		const messageSendTime = sendTime
		if (!messageSendTime) return t("ui.agentLabel")
		return dayjs(messageSendTime * 1000).format("MM/DD HH:mm")
	}, [sendTime, t])

	const assistantAvatar = renderAssistantAvatar?.({
		className: classNames?.icon,
	}) ?? (
		<img
			src={getAvatarUrl(avatarUrl, 24)}
			alt=""
			className={cn(
				"z-[10] flex size-6 items-center justify-center rounded-full",
				classNames?.icon,
			)}
			data-testid="with-node-image"
		/>
	)
	return (
		<div className="relative w-full pt-[24px] last:mb-0">
			<div
				className={cn(
					"z-2 absolute left-[-25px] top-[-3px] flex h-6 w-full gap-1.5",
					"mb-[14px]",
					classNames?.header,
				)}
			>
				{assistantAvatar}
				<span className="text-[12px] leading-6 text-muted-foreground">{formattedTime}</span>
			</div>
			{children}
		</div>
	)
})
