import { memo } from "react"
import { useTranslation } from "react-i18next"
import type { SelfMediaPlatform } from "../../../types"

interface UnsupportedPlatformProps {
	platform?: SelfMediaPlatform | null
}

function UnsupportedPlatform({ platform }: UnsupportedPlatformProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background text-center text-sm text-muted-foreground"
			data-testid="self-media-unsupported"
		>
			<div className="text-base font-medium text-foreground">
				{t("detail.selfMedia.unsupported.title")}
			</div>
			<div>
				{t("detail.selfMedia.unsupported.description", {
					platform: platform || t("common.unknown"),
				})}
			</div>
		</div>
	)
}

export default memo(UnsupportedPlatform)
