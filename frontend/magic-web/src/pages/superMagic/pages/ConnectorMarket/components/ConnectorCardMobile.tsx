import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	Check,
	Ellipsis,
	KeyRound,
	Loader2,
	Pause,
	Pencil,
	Play,
	ShieldCheck,
	Trash2,
} from "lucide-react"
import type { KeyboardEvent } from "react"
import dayjs from "@/infrastructure/vendors/dayjs"
import { Button } from "@/components/shadcn-ui/button"
import MagicDropdown from "@/components/base/MagicDropdown"
import MagicImage from "@/components/base/MagicImage"
import { Badge } from "@/components/shadcn-ui/badge"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { MCPType, type IMCPItem } from "@/components/Agent/MCP/types"
import { renderMarkdownLinks } from "@/components/Agent/MCP/renderMarkdownLinks"
import { hasAdminRight, hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { normalizeLocale } from "@/utils/locale"

interface ConnectorCardMobileProps {
	connector: IMCPItem
	selected?: boolean
	loading?: boolean
	onToggle?: (connector: IMCPItem) => void
	onOpenDetail?: (connector: IMCPItem) => void
	showManageMenu?: boolean
	descriptionMaxLines?: 3 | 4
	onEdit?: (connector: IMCPItem) => void
	onAuthorize?: (connector: IMCPItem) => void
	onManagePermissions?: (connector: IMCPItem) => void
	onDelete?: (connector: IMCPItem) => void
	onToggleEnabled?: (connector: IMCPItem) => void
}

export default function ConnectorCardMobile({
	connector,
	selected = false,
	loading = false,
	onToggle,
	onOpenDetail,
	showManageMenu = false,
	descriptionMaxLines = 3,
	onEdit,
	onAuthorize,
	onManagePermissions,
	onDelete,
	onToggleEnabled,
}: ConnectorCardMobileProps) {
	const { t, i18n } = useTranslation("crew/market")
	const { t: tAgent } = useTranslation("agent")
	const { t: tFlow } = useTranslation("flow")
	const description = connector.description || t("connectors.descriptionFallback")
	const descriptionNodes = renderMarkdownLinks(description, {
		linkClassName: "text-primary underline underline-offset-2 hover:opacity-90",
		linkTestId: "connector-mobile-card-description-link",
		iconSize: 10,
	})
	const updatedAtLabel = useMemo(() => {
		if (!connector.updated_at) return null
		const parsed = dayjs(connector.updated_at)
		if (!parsed.isValid()) return connector.updated_at
		const localeTag = normalizeLocale(i18n.language).replace("_", "-")
		if (localeTag.startsWith("zh")) return parsed.format("YYYY年M月D日 HH:mm")
		try {
			return new Intl.DateTimeFormat(localeTag, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(parsed.toDate())
		} catch {
			return parsed.format("YYYY-MM-DD HH:mm")
		}
	}, [connector.updated_at, i18n.language])
	const updatedAtText = updatedAtLabel
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return
		event.preventDefault()
		onOpenDetail?.(connector)
	}
	const canEdit = hasEditRight(connector.user_operation)
	const isDisabled = showManageMenu && connector.enabled === false
	const menuItems = [
		...(canEdit
			? [
					{
						key: "edit",
						icon: <Pencil className="size-4" />,
						label: t("connectors.edit"),
						onClick: () => onEdit?.(connector),
						"data-testid": "connector-mobile-card-edit",
					},
				]
			: []),
		...(canEdit && connector.type === MCPType.Tool
			? [
					{
						key: "authorize",
						icon: <KeyRound className="size-4" />,
						label: tAgent("mcp.panel.auth"),
						onClick: () => onAuthorize?.(connector),
						"data-testid": "connector-mobile-card-authorize",
					},
				]
			: []),
		...(canEdit
			? [
					{
						key: "manage-permissions",
						icon: <ShieldCheck className="size-4" />,
						label: tFlow("common.manageRights"),
						onClick: () => onManagePermissions?.(connector),
						"data-testid": "connector-mobile-card-manage-permissions",
					},
				]
			: []),
		...(canEdit
			? [
					{
						key: "toggle-enabled",
						icon: connector.enabled ? (
							<Pause className="size-4" />
						) : (
							<Play className="size-4" />
						),
						label: connector.enabled ? t("connectors.disable") : t("connectors.enable"),
						onClick: () => onToggleEnabled?.(connector),
						"data-testid": "connector-mobile-card-toggle-enabled",
					},
				]
			: []),
		...(hasAdminRight(connector.user_operation)
			? [
					{
						key: "delete",
						icon: <Trash2 className="size-4 text-destructive" />,
						label: <span className="text-destructive">{t("connectors.delete")}</span>,
						onClick: () => onDelete?.(connector),
						"data-testid": "connector-mobile-card-delete",
					},
				]
			: []),
	]

	return (
		<div
			className="relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-popover p-2.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
			onClick={() => onOpenDetail?.(connector)}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
			data-testid="connector-mobile-card"
		>
			<div className="flex min-w-0 items-start gap-2">
				<MagicImage
					className="size-9 shrink-0 rounded-lg border border-border"
					src={connector.icon}
					alt={connector.name}
					fallback={
						<div className="size-9 overflow-hidden rounded-lg">
							<IconMCP size="100%" />
						</div>
					}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex min-w-0 items-start justify-between gap-2">
						<p
							className={`min-w-0 flex-1 truncate pt-0.5 text-sm font-medium leading-6 text-foreground ${isDisabled ? "pr-16" : ""}`}
						>
							{connector.name}
						</p>
					</div>
					<p
						className={`${descriptionMaxLines === 4 ? "line-clamp-4" : "line-clamp-3"} text-xs leading-4 text-muted-foreground`}
						onClick={(event) => {
							if (event.target instanceof HTMLAnchorElement) event.stopPropagation()
						}}
					>
						{descriptionNodes}
					</p>
				</div>
			</div>
			<div className="h-px w-full bg-border" />
			{isDisabled ? (
				<Badge
					variant="secondary"
					className="absolute right-2.5 top-2.5 z-10 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
					data-testid="connector-mobile-card-disabled-badge"
				>
					{t("connectors.disabled")}
				</Badge>
			) : (
				<Button
					variant="default"
					size="sm"
					className="h-8 w-full text-xs shadow-xs"
					disabled={loading}
					onClick={(event) => {
						event.stopPropagation()
						void Promise.resolve(onToggle?.(connector)).catch(console.error)
					}}
					data-testid="connector-mobile-card-toggle-button"
				>
					{loading ? <Loader2 className="size-4 animate-spin" /> : null}
					{!loading && selected ? <Check className="size-4" /> : null}
					{!loading ? (selected ? t("connectors.added") : t("connectors.install")) : null}
				</Button>
			)}
			<div className="min-h-6" aria-hidden="true" />
			{showManageMenu ? (
				<div className="pointer-events-none absolute bottom-1 left-2.5 right-10 flex min-h-6 items-center">
					{updatedAtText ? (
						<div
							className="flex min-w-0 flex-col justify-center gap-0.5 leading-tight"
							data-testid="connector-mobile-card-updated-at"
						>
							<span className="text-[10px] text-muted-foreground/60">
								{t("connectors.updatedAtLabel")}
							</span>
							<span className="truncate text-[11px] text-muted-foreground/80">
								{updatedAtText}
							</span>
						</div>
					) : null}
				</div>
			) : null}
			{showManageMenu && canEdit ? (
				<MagicDropdown menu={{ items: menuItems }} placement="bottomRight" model>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute bottom-1 right-2.5 z-10 size-6 rounded-md hover:bg-accent"
						aria-label={t("connectors.moreActionsAria")}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
						}}
					>
						<span data-testid="connector-mobile-card-more-button">
							<Ellipsis className="size-4 text-muted-foreground" />
						</span>
					</Button>
				</MagicDropdown>
			) : null}
		</div>
	)
}
