import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { IconBan } from "@tabler/icons-react"
import { Hand, Check } from "lucide-react"
import BaseRichText from "@/pages/superMagic/components/MessageList/components/Text/components/RichText"

/** Base styles shared by all status badge boxes */
const boxBase = "rounded-[12px] inline-flex px-2 py-1 items-center text-xs gap-1 [&_p]:mb-0"

export function StatusBadge(props: { status: string }) {
	const { status } = props

	const { t } = useTranslation("super")

	/** 错误 */
	if (status === "error") {
		return (
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
		)
	}

	/** 暂停 */
	if (status === "suspended") {
		return (
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
		)
	}

	/** 完成 */
	if (status === "finished") {
		return (
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
		)
	}

	return null
}
