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
	Plus,
	ShieldCheck,
	Trash2,
} from "lucide-react"
import type { KeyboardEvent } from "react"
import dayjs from "@/infrastructure/vendors/dayjs"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import MagicDropdown from "@/components/base/MagicDropdown"
import SmartTooltip from "@/components/other/SmartTooltip"
import MagicImage from "@/components/base/MagicImage"
import { Badge } from "@/components/shadcn-ui/badge"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { MCPType, type IMCPItem } from "@/components/Agent/MCP/types"
import { renderMarkdownLinks } from "@/components/Agent/MCP/renderMarkdownLinks"
import { hasAdminRight, hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { normalizeLocale } from "@/utils/locale"

interface ConnectorCardProps {
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

interface MenuActionInfo {
	domEvent?: {
		preventDefault?: () => void
		stopPropagation?: () => void
	}
}

export default function ConnectorCard({
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
}: ConnectorCardProps) {
	const { t, i18n } = useTranslation("crew/market")
	const { t: tAgent } = useTranslation("agent")
	const { t: tFlow } = useTranslation("flow")
	const description = connector.description || t("connectors.descriptionFallback")
	const descriptionNodes = renderMarkdownLinks(description, {
		linkClassName: "text-primary underline underline-offset-2 hover:opacity-90",
		linkTestId: "connector-card-description-link",
		iconSize: 11,
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

	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
						onClick: ({ domEvent }: MenuActionInfo) => {
							domEvent?.stopPropagation?.()
							onEdit?.(connector)
						},
						"data-testid": "connector-card-edit",
					},
				]
			: []),
		...(canEdit && connector.type === MCPType.Tool
			? [
					{
						key: "authorize",
						icon: <KeyRound className="size-4" />,
						label: tAgent("mcp.panel.auth"),
						onClick: ({ domEvent }: MenuActionInfo) => {
							domEvent?.stopPropagation?.()
							onAuthorize?.(connector)
						},
						"data-testid": "connector-card-authorize",
					},
				]
			: []),
		...(canEdit
			? [
					{
						key: "manage-permissions",
						icon: <ShieldCheck className="size-4" />,
						label: tFlow("common.manageRights"),
						onClick: ({ domEvent }: MenuActionInfo) => {
							domEvent?.stopPropagation?.()
							onManagePermissions?.(connector)
						},
						"data-testid": "connector-card-manage-permissions",
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
						onClick: ({ domEvent }: MenuActionInfo) => {
							domEvent?.stopPropagation?.()
							onToggleEnabled?.(connector)
						},
						"data-testid": "connector-card-toggle-enabled",
					},
				]
			: []),
		...(hasAdminRight(connector.user_operation)
			? [
					{
						key: "delete",
						icon: <Trash2 className="size-4 text-destructive" />,
						label: <span className="text-destructive">{t("connectors.delete")}</span>,
						onClick: ({ domEvent }: MenuActionInfo) => {
							domEvent?.stopPropagation?.()
							onDelete?.(connector)
						},
						"data-testid": "connector-card-delete",
					},
				]
			: []),
	]

	return (
		<article
			className={`group relative flex overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_8px_26px_rgba(24,25,29,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_30px_rgba(24,25,29,0.07)] ${showManageMenu ? "h-[188px] sm:h-[192px]" : "h-[168px] sm:h-[176px]"}`}
			data-testid="connector-card"
		>
			<div
				role="button"
				tabIndex={0}
				className={`flex h-full w-full flex-1 cursor-pointer flex-col ${descriptionMaxLines === 4 ? "gap-1.5" : "gap-3.5"} rounded-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5`}
				onClick={() => onOpenDetail?.(connector)}
				onKeyDown={handleKeyDown}
				aria-label={connector.name}
				data-testid="connector-card-detail-button"
			>
				<div className="flex min-w-0 items-start gap-3">
					<MagicImage
						className="relative size-10 shrink-0 rounded-xl border-0 bg-muted/40 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
						src={connector.icon}
						alt={connector.name}
						fallback={
							<div className="size-10 overflow-hidden rounded-xl">
								<IconMCP size="100%" />
							</div>
						}
					/>
					<div className="min-w-0 flex-1 pr-10">
						<p className="min-w-0 truncate pt-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
							{connector.name}
						</p>
					</div>
				</div>

				<SmartTooltip
					elementType="div"
					maxLines={descriptionMaxLines}
					className="min-h-[2.75rem] text-[13px] leading-[1.65] text-muted-foreground transition-colors duration-200 group-hover:text-foreground/90"
					content={descriptionNodes}
					sideOffset={4}
					onClick={(event) => {
						if (event.target instanceof HTMLAnchorElement) event.stopPropagation()
					}}
				>
					{descriptionNodes}
				</SmartTooltip>
			</div>
			{showManageMenu ? (
				<div className="pointer-events-none absolute bottom-3 left-4 right-14 flex min-h-7 items-center sm:left-5 sm:right-16">
					{updatedAtText ? (
						<div
							className="flex min-w-0 flex-col justify-center gap-0.5 leading-tight"
							data-testid="connector-card-updated-at"
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
						className="absolute bottom-3 right-4 z-10 size-7 rounded-md hover:bg-accent"
						aria-label={t("connectors.moreActionsAria")}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
						}}
					>
						<span data-testid="connector-card-more-button">
							<Ellipsis className="size-4 text-muted-foreground" />
						</span>
					</Button>
				</MagicDropdown>
			) : null}
			{isDisabled ? (
				<Badge
					variant="secondary"
					className="absolute right-4 top-4 z-10 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
					data-testid="connector-card-disabled-badge"
				>
					{t("connectors.disabled")}
				</Badge>
			) : (
				<MagicTooltip title={!selected && !loading ? t("connectors.install") : undefined}>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className={
							"absolute right-4 top-4 z-10 size-8 rounded-lg " +
							(selected
								? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-100 dark:text-emerald-400"
								: "bg-muted/80 text-foreground/80 hover:bg-muted")
						}
						disabled={loading}
						aria-label={selected ? t("connectors.added") : t("connectors.install")}
						onClick={(event) => {
							event.stopPropagation()
							void Promise.resolve(onToggle?.(connector)).catch(console.error)
						}}
						data-testid="connector-card-toggle-button"
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : selected ? (
							<Check className="size-4" />
						) : (
							<Plus className="size-4" />
						)}
					</Button>
				</MagicTooltip>
			)}
		</article>
	)
}
