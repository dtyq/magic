import { useTranslation } from "react-i18next"
import { MAGIC_CLAW_STATUS, type MagicClawStatus } from "@/apis/modules/magicClawStatus"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"
import { MAGI_CLAW_DISPLAY_STATUS, type MagiClawDisplayStatus } from "./magiClawDisplayStatus"

interface MagicClawStatusBadgeProps {
	status?: MagicClawStatus | string | null
	className?: string
	"data-testid"?: string
}

interface MagicClawStatusBadgeConfig {
	dotClassName: string
	labelKey: string
}

const MAGIC_CLAW_STATUS_BADGE_CONFIG_MAP: Record<
	MagicClawStatus | MagiClawDisplayStatus,
	MagicClawStatusBadgeConfig
> = {
	[MAGIC_CLAW_STATUS.PENDING]: {
		dotClassName: "bg-orange-500",
		labelKey: "superLobster.created.status.starting",
	},
	[MAGI_CLAW_DISPLAY_STATUS.RESTARTING]: {
		dotClassName: "bg-orange-500",
		labelKey: "superLobster.created.status.restarting",
	},
	[MAGIC_CLAW_STATUS.RUNNING]: {
		dotClassName: "bg-green-500",
		labelKey: "superLobster.created.status.running",
	},
	[MAGIC_CLAW_STATUS.EXITED]: {
		dotClassName: "bg-slate-400",
		labelKey: "superLobster.created.status.stopped",
	},
	[MAGIC_CLAW_STATUS.UNKNOWN]: {
		dotClassName: "bg-slate-400",
		labelKey: "superLobster.created.status.unknown",
	},
	[MAGIC_CLAW_STATUS.NOT_FOUND]: {
		dotClassName: "bg-slate-400",
		labelKey: "superLobster.created.status.notFound",
	},
}

export function getMagicClawStatusBadgeConfig(
	status?: MagicClawStatus | string | null,
): MagicClawStatusBadgeConfig {
	return (
		MAGIC_CLAW_STATUS_BADGE_CONFIG_MAP[status as MagicClawStatus | MagiClawDisplayStatus] ??
		MAGIC_CLAW_STATUS_BADGE_CONFIG_MAP[MAGIC_CLAW_STATUS.UNKNOWN]
	)
}

export function MagiClawStatusBadge({
	status,
	className,
	"data-testid": dataTestId,
}: MagicClawStatusBadgeProps) {
	const { t } = useTranslation("sidebar")
	const config = getMagicClawStatusBadgeConfig(status)

	return (
		<Badge
			variant="outline"
			className={cn(
				"h-6 shrink-0 gap-1 rounded-md border-border bg-background px-2 py-0 text-xs font-normal text-foreground shadow-none",
				className,
			)}
			data-testid={dataTestId}
		>
			<span className={cn("size-2 rounded-full", config.dotClassName)} aria-hidden />
			{t(config.labelKey)}
		</Badge>
	)
}
