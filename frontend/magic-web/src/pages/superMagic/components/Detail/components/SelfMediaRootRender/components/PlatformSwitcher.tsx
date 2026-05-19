import { useCallback, memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { cn } from "@/lib/utils"
import type { SelfMediaPlatform } from "../../../types"
import PlatformBrandIcon from "./PlatformBrandIcon"

interface PlatformSwitcherProps {
	platforms: SelfMediaPlatform[]
	activePlatform: SelfMediaPlatform | null
	onChange: (platform: SelfMediaPlatform) => void
	className?: string
}

function usePlatformLabel() {
	const { t } = useTranslation("super")
	return useCallback(
		(platform: SelfMediaPlatform) =>
			t(`detail.selfMedia.platform.${platform}.title`, {
				defaultValue: platform,
			}),
		[t],
	)
}

/** Root-level switcher for multi-platform self-media projects. */
function PlatformSwitcher({
	platforms,
	activePlatform,
	onChange,
	className,
}: PlatformSwitcherProps) {
	const platformLabel = usePlatformLabel()

	const current =
		activePlatform && platforms.includes(activePlatform) ? activePlatform : platforms[0]

	const currentLabel = platformLabel(current)

	// Hide when only a single platform is declared.
	if (platforms.length <= 1)
		return (
			<span className="flex min-w-0 max-w-full flex-1 items-center gap-2 text-left">
				<PlatformBrandIcon platform={current} className="size-3.5" />
				<span className="min-w-0 flex-1 truncate text-xs">{currentLabel}</span>
			</span>
		)

	return (
		<div
			className={cn("flex min-w-0 items-center", className)}
			data-testid="self-media-platform-switcher"
		>
			<Select value={current} onValueChange={(value) => onChange(value as SelfMediaPlatform)}>
				<SelectTrigger
					size="sm"
					className="h-8 w-fit min-w-0 max-w-full text-xs"
					data-testid="self-media-platform-switcher-trigger"
				>
					<SelectValue>
						<span className="flex min-w-0 max-w-full flex-1 items-center gap-2 text-left">
							<PlatformBrandIcon platform={current} className="size-3.5" />
							<span className="min-w-0 flex-1 truncate text-xs">{currentLabel}</span>
						</span>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{platforms.map((platform) => {
						const itemLabel = platformLabel(platform)
						return (
							<SelectItem
								key={platform}
								value={platform}
								textValue={itemLabel}
								data-testid={`self-media-platform-switcher-option-${platform}`}
							>
								<span className="flex w-full min-w-0 items-center gap-2">
									<PlatformBrandIcon platform={platform} className="size-3.5" />
									<span className="min-w-0 flex-1 truncate text-xs">
										{itemLabel}
									</span>
								</span>
							</SelectItem>
						)
					})}
				</SelectContent>
			</Select>
		</div>
	)
}

export default memo(PlatformSwitcher)
