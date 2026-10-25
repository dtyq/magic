import { Code2, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/utils/cn"

export type MicroAppPageMode = "development" | "preview"

interface MicroAppModeSwitcherProps {
	value: MicroAppPageMode
	onChange: (value: MicroAppPageMode) => void
	"aria-label"?: string
}

export default function MicroAppModeSwitcher({
	value,
	onChange,
	"aria-label": ariaLabel,
}: MicroAppModeSwitcherProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex h-8 items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
			role="tablist"
			aria-label={ariaLabel || t("microAppPage.mode.ariaLabel")}
			data-testid="micro-app-mode-switcher"
		>
			<button
				type="button"
				role="tab"
				aria-selected={value === "development"}
				className={cn(
					"flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
					value === "development"
						? "bg-background font-medium text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onChange("development")}
				data-testid="micro-app-mode-development"
			>
				<Code2 className="size-3.5" aria-hidden />
				{t("microAppPage.mode.development")}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={value === "preview"}
				className={cn(
					"flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
					value === "preview"
						? "bg-background font-medium text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onChange("preview")}
				data-testid="micro-app-mode-preview"
			>
				<Eye className="size-3.5" aria-hidden />
				{t("microAppPage.mode.preview")}
			</button>
		</div>
	)
}
