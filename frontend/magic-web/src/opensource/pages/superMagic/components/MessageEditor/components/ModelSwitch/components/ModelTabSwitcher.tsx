import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"

interface ModelTabSwitcherProps {
	activeTab: "language" | "image"
	onTabChange: (tab: "language" | "image") => void
}

export function ModelTabSwitcher({ activeTab, onTabChange }: ModelTabSwitcherProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex flex-col gap-1.5 self-stretch px-4 pb-2.5">
			<div className="flex items-stretch justify-stretch gap-0 rounded-[10px] bg-sidebar p-[3px]">
				<button
					className={cn(
						"flex flex-1 items-center justify-center gap-1.5 px-2 py-1",
						"cursor-pointer rounded-md border-none bg-transparent",
						"text-sm font-medium leading-5 text-foreground transition-all duration-200",
						"hover:bg-accent",
						activeTab === "language" &&
							"bg-card shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1),0px_1px_3px_0px_rgba(0,0,0,0.1)]",
					)}
					onClick={() => onTabChange("language")}
				>
					{t("messageEditor.modelSwitch.languageModel")}
				</button>
				<button
					className={cn(
						"flex flex-1 items-center justify-center gap-1.5 px-2 py-1",
						"cursor-pointer rounded-md border-none bg-transparent",
						"text-sm font-medium leading-5 text-foreground transition-all duration-200",
						"hover:bg-accent",
						activeTab === "image" &&
							"bg-card shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1),0px_1px_3px_0px_rgba(0,0,0,0.1)]",
					)}
					onClick={() => onTabChange("image")}
				>
					{t("messageEditor.modelSwitch.imageModel")}
				</button>
			</div>
		</div>
	)
}
