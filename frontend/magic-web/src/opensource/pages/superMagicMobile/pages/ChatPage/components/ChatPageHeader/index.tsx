import { Menu } from "lucide-react"
import { useTranslation } from "react-i18next"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { SupportLocales } from "@/opensource/constants/locale"

interface ChatPageHeaderProps {
	onMenuClick: () => void
}

export default function ChatPageHeader({ onMenuClick }: ChatPageHeaderProps) {
	const { i18n } = useTranslation()
	const globalConfig = globalConfigStore.globalConfig

	return (
		<div className="w-full shrink-0 rounded-b-xl bg-background px-2.5 pt-safe-top shadow-xs">
			<div className="flex h-12 w-full items-center gap-2">
				{globalConfig?.minimal_logo && (
					<img
						className="rounded-lg"
						src={globalConfig?.minimal_logo}
						alt={globalConfig?.name_i18n?.[i18n.language as SupportLocales]}
						width={32}
						draggable={false}
					/>
				)}

				{/* 标题 */}
				<div className="min-w-0 flex-1 truncate text-lg font-medium text-foreground">
					{globalConfig?.name_i18n?.[i18n.language as SupportLocales]}
				</div>

				{/* 右侧按钮组 */}
				<div className="flex shrink-0 items-center gap-1">
					<div className="flex size-8 items-center justify-center" onClick={onMenuClick}>
						<Menu size={20} />
					</div>
				</div>
			</div>
		</div>
	)
}
