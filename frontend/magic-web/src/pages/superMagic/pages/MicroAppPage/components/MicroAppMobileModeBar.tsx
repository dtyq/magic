import { Code2, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/utils/cn"

import type { MicroAppPageMode } from "./MicroAppModeSwitcher"

interface MicroAppMobileModeBarProps {
	value: MicroAppPageMode
	onChange: (value: MicroAppPageMode) => void
}

export default function MicroAppMobileModeBar({ value, onChange }: MicroAppMobileModeBarProps) {
	const { t } = useTranslation("super")
	const modes = [
		{
			value: "development" as const,
			icon: Code2,
			label: t("microAppPage.mode.development"),
		},
		{ value: "preview" as const, icon: Eye, label: t("microAppPage.mode.preview") },
	]

	return (
		<div
			className="flex h-11 shrink-0 items-center border-b border-border bg-background px-3"
			data-testid="micro-app-mobile-mode-bar"
			role="tablist"
			aria-label={t("microAppPage.mode.ariaLabel")}
		>
			<div className="grid h-9 w-full grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
				{modes.map(({ value: mode, icon: Icon, label }) => (
					<button
						key={mode}
						type="button"
						role="tab"
						aria-selected={value === mode}
						className={cn(
							"flex items-center justify-center gap-1.5 rounded-md text-xs transition-colors",
							value === mode
								? "bg-background font-medium text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => onChange(mode)}
						data-testid={`micro-app-mobile-mode-${mode}`}
					>
						<Icon className="size-3.5" aria-hidden />
						{label}
					</button>
				))}
			</div>
		</div>
	)
}
