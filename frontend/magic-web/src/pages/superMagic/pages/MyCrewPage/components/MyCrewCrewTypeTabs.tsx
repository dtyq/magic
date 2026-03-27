import { memo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export type MyCrewCrewTypeTab = "created" | "hired"

interface MyCrewCrewTypeTabsProps {
	value: MyCrewCrewTypeTab
	onChange: (value: MyCrewCrewTypeTab) => void
	className?: string
	"data-testid"?: string
}

function MyCrewCrewTypeTabs({
	value,
	onChange,
	className,
	"data-testid": dataTestId,
}: MyCrewCrewTypeTabsProps) {
	const { t } = useTranslation("crew/market")

	return (
		<div
			className={cn(
				"flex h-9 w-full shrink-0 items-center gap-0 rounded-[10px] bg-muted p-[3px]",
				className,
			)}
			data-testid={dataTestId ?? "my-crew-crew-type-tabs"}
			role="tablist"
			aria-label={t("myCrewPage.crewType.ariaLabel")}
		>
			<button
				type="button"
				role="tab"
				aria-selected={value === "created"}
				className={cn(
					"flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-md px-2 py-1",
					"text-sm font-medium text-foreground transition-colors",
					value === "created"
						? "border border-transparent bg-background shadow-sm"
						: "border border-transparent bg-transparent",
				)}
				onClick={() => onChange("created")}
				data-testid="my-crew-tab-created"
			>
				{t("myCrewPage.crewType.createdByMe")}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={value === "hired"}
				className={cn(
					"flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-md px-2 py-1",
					"text-sm font-medium text-foreground transition-colors",
					value === "hired"
						? "border border-transparent bg-background shadow-sm"
						: "border border-transparent bg-transparent",
				)}
				onClick={() => onChange("hired")}
				data-testid="my-crew-tab-hired"
			>
				{t("myCrewPage.crewType.hiredByMe")}
			</button>
		</div>
	)
}

export default memo(MyCrewCrewTypeTabs)
