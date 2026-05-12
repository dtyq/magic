import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { isSupportedSourceChannel, sourceChannelMetaMap, sourceTagBaseClassName } from "./constants"
import type { SourceTagProps } from "./types"

function SourceTag({ source }: SourceTagProps) {
	const { t } = useTranslation("super")
	const sourceMeta = source?.extra?.super_agent?.source

	if (!sourceMeta?.channel) return null
	if (!isSupportedSourceChannel(sourceMeta.channel)) return null

	const channelMeta = sourceChannelMetaMap[sourceMeta.channel]

	return (
		<Badge
			variant="outline"
			className={cn(sourceTagBaseClassName, channelMeta.className)}
			data-testid="super-magic-source-tag"
		>
			<channelMeta.Icon aria-hidden="true" className="size-3 shrink-0" />
			<span>{t(channelMeta.labelKey)}</span>
		</Badge>
	)
}

export default SourceTag
