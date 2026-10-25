import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import IconFacebook from "@/enhance/tabler/icons-react/icons/IconFacebook"
import IconInstagram from "@/enhance/tabler/icons-react/icons/IconInstagram"
import IconRednote from "@/enhance/tabler/icons-react/icons/IconRednote"
import IconTiktok from "@/enhance/tabler/icons-react/icons/IconTiktok"
import IconWechatChannels from "@/enhance/tabler/icons-react/icons/IconWechatChannels"
import IconWechatOfficialAccounts from "@/enhance/tabler/icons-react/icons/IconWechatOfficialAccounts"
import IconX from "@/enhance/tabler/icons-react/icons/IconX"
import { ALL_PLATFORMS } from "../../types"
import type { SelfMediaPlatform } from "../../../../../../types"

interface StepPlatformSelectProps {
	selectedPlatforms: SelfMediaPlatform[]
	onChange: (platforms: SelfMediaPlatform[]) => void
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
	rednote: IconRednote,
	instagram: IconInstagram,
	"wechat-official-accounts": IconWechatOfficialAccounts,
	tiktok: IconTiktok,
	x: IconX,
	facebook: IconFacebook,
	"wechat-channels": IconWechatChannels,
}

export default function StepPlatformSelect({
	selectedPlatforms,
	onChange,
}: StepPlatformSelectProps) {
	const { t } = useTranslation("super")

	const togglePlatform = (platform: SelfMediaPlatform) => {
		if (selectedPlatforms.includes(platform)) {
			onChange(selectedPlatforms.filter((p) => p !== platform))
		} else {
			onChange([...selectedPlatforms, platform])
		}
	}

	return (
		<div className="mx-auto max-w-xl">
			<div className="mb-8 text-center">
				<h2 className="mb-2 text-xl font-bold tracking-tight">选择目标发布平台</h2>
				<p className="text-sm text-muted-foreground">
					选择你要发布内容的平台，AI 将根据平台特性定制内容策略
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{ALL_PLATFORMS.map((platform) => {
					const isSelected = selectedPlatforms.includes(platform.value)
					return (
						<button
							key={platform.value}
							type="button"
							disabled={platform.disabled}
							className={cn(
								"group relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all duration-200",
								isSelected
									? "border-primary bg-primary/5 shadow-md shadow-primary/10"
									: "border-border/60 hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm",
								platform.disabled && "cursor-not-allowed opacity-40",
							)}
							onClick={() => !platform.disabled && togglePlatform(platform.value)}
							data-testid="toggle-platform"
						>
							{/* Selection indicator */}
							{isSelected && (
								<div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="white"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
										data-testid="step-platform-select-svg"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</div>
							)}

							<span className="flex items-center justify-center text-2xl">
								{(() => {
									const Icon = PLATFORM_ICONS[platform.value]
									return Icon ? <Icon size={28} /> : "🌐"
								})()}
							</span>
							<span
								className={cn(
									"text-sm font-medium transition-colors",
									isSelected ? "text-primary" : "text-foreground",
								)}
							>
								{t(platform.labelKey)}
							</span>
							{platform.disabled && (
								<span className="absolute bottom-2 text-[10px] text-muted-foreground">
									即将支持
								</span>
							)}
						</button>
					)
				})}
			</div>

			{selectedPlatforms.length > 0 && (
				<div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-primary/5 px-4 py-2.5">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-primary"
						data-testid="step-platform-select-svg-2"
					>
						<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9" />
					</svg>
					<span className="text-xs text-primary font-medium">
						已选择 {selectedPlatforms.length} 个平台，AI 将为你优化多平台内容适配
					</span>
				</div>
			)}
		</div>
	)
}
