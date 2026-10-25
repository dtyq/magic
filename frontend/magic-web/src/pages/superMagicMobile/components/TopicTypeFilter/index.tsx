import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Filter, X } from "lucide-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import {
	toggleTopicType,
	type TopicTypeFilterValue,
} from "@/pages/superMagic/utils/topicTypeFilter"

export default function MobileTopicTypeFilter({
	value,
	onChange,
}: {
	value: TopicTypeFilterValue
	onChange: (value: TopicTypeFilterValue) => void
}) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const options = [
		{ value: "all" as const, label: t("topicTypeFilter.all") },
		{ value: "topic" as const, label: t("topicTypeFilter.topic") },
		{ value: "scheduled_task" as const, label: t("topicTypeFilter.scheduledTask") },
	]
	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					"size-10 shrink-0 rounded-full",
					value !== "all" && "bg-accent text-primary",
				)}
				aria-label={t("topicTypeFilter.label")}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen(true)}
			>
				<Filter className="size-5" />
			</Button>
			<MagicPopup
				visible={open}
				onClose={() => setOpen(false)}
				position="bottom"
				title={t("topicTypeFilter.label")}
				headerVariant="actionHeader"
				headerTitle={t("topicTypeFilter.label")}
				headerTrailingAction={{
					icon: <X className="size-5" />,
					ariaLabel: t("button.close", { ns: "interface" }),
					onClick: () => setOpen(false),
				}}
			>
				<div className="space-y-1 px-3 pb-3">
					{options.map((option) => {
						const checked = value === "all" || value === option.value
						return (
							<button
								key={option.value}
								type="button"
								role="checkbox"
								aria-checked={checked}
								className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent"
								onClick={() => onChange(toggleTopicType(value, option.value))}
							>
								{option.label}
								{checked && <Check className="size-5 text-primary" />}
							</button>
						)
					})}
				</div>
			</MagicPopup>
		</>
	)
}
