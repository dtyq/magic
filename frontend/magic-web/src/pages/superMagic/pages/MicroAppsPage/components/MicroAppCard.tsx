import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ArrowUpRight, ExternalLink, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import MicroAppCardCover from "./MicroAppCardCover"

interface MicroAppCardProps {
	id: string
	title: string
	description?: string
	meta: string
	coverUrl?: string
	statusLabel?: string
	onClick: () => void
	testId: string
	external?: boolean
	compact?: boolean
	trailingActions?: ReactNode
	variant?: "desktop" | "mobile"
	onOpenInNewWindow: () => void
	onRename: () => void
	onDelete: () => void
	onManageCollaborators?: () => void
	managingCollaborators?: boolean
	canDelete?: boolean
	canRename: boolean
	canManageCollaborators?: boolean
}

export default function MicroAppCard({
	id,
	title,
	description,
	meta,
	coverUrl,
	statusLabel,
	onClick,
	testId,
	external = false,
	compact = false,
	trailingActions,
	variant = "desktop",
	onOpenInNewWindow,
	onRename,
	onDelete,
	onManageCollaborators,
	managingCollaborators = false,
	canDelete = true,
	canRename,
	canManageCollaborators = false,
}: MicroAppCardProps) {
	const { t } = useTranslation("super")
	const reduceMotion = Boolean(useReducedMotion())
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const menuActions = [
		{
			label: t("microAppsPage.actions.openInNewWindow"),
			icon: ExternalLink,
			onSelect: onOpenInNewWindow,
			destructive: false,
			disabled: false,
		},
		...(canRename
			? [
					{
						label: t("microAppsPage.actions.rename"),
						icon: Pencil,
						onSelect: onRename,
						destructive: false,
						disabled: false,
					},
				]
			: []),
		...(canManageCollaborators && onManageCollaborators
			? [
					{
						label: t("microAppsPage.actions.manageCollaborators"),
						icon: Users,
						onSelect: onManageCollaborators,
						destructive: false,
						disabled: managingCollaborators,
					},
				]
			: []),
		...(canDelete
			? [
					{
						label: t("microAppsPage.actions.deleteApp"),
						icon: Trash2,
						onSelect: onDelete,
						destructive: true,
						disabled: false,
					},
				]
			: []),
	]

	const card = (
		<motion.div
			data-app-card
			data-compact={compact}
			className={cn(
				"group relative min-w-0 rounded-2xl text-left transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 motion-reduce:transition-none",
				trailingActions
					? "flex items-center gap-3 rounded-none border-b border-border/50 pr-2 hover:bg-muted/40"
					: compact
						? "border border-transparent hover:border-border/50 hover:bg-card/80 hover:shadow-sm"
						: "h-full rounded-[18px] border border-border/60 bg-card shadow-[0_3px_0_rgb(var(--muted-rgb)/0.7)] hover:border-primary/25 hover:shadow-md",
			)}
			initial={false}
			whileHover={reduceMotion || trailingActions ? undefined : { y: -2 }}
			whileTap={reduceMotion || trailingActions ? undefined : { scale: 0.985 }}
			transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
		>
			<button
				type="button"
				className={cn(
					"block h-full w-full text-left focus-visible:outline-none",
					compact ? "px-2 py-3" : "p-2",
					trailingActions && "min-w-0 flex-1",
				)}
				onClick={onClick}
				data-testid={testId}
			>
				<div className={cn("flex", compact ? "items-center gap-3" : "h-full flex-col")}>
					<MicroAppCardCover id={id} coverUrl={coverUrl} compact={compact} />
					<div
						className={cn(
							"min-w-0 flex-1",
							compact ? "pr-6" : "flex flex-col px-2 pb-1 pt-3",
						)}
					>
						<p
							title={title}
							className={cn(
								"line-clamp-2 text-sm font-medium leading-5 tracking-[-0.01em] text-foreground",
								!compact && "min-h-10",
							)}
						>
							{title}
						</p>
						{description && !compact ? (
							<p className="mt-1 truncate text-xs text-muted-foreground">
								{description}
							</p>
						) : null}
						<div
							className={cn(
								"flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-muted-foreground",
								compact ? "mt-1.5" : "mt-auto pt-3",
							)}
						>
							{statusLabel ? (
								<span
									className={cn(
										"inline-flex shrink-0 items-center gap-1.5",
										!compact && "rounded-md bg-muted/60 px-1.5 py-0.5",
									)}
								>
									<span className="size-1 rounded-full bg-current opacity-50" />
									{statusLabel}
								</span>
							) : null}
							<span className="truncate">{meta}</span>
							{external ? (
								<ArrowUpRight
									className="ml-auto size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
									aria-hidden
								/>
							) : null}
						</div>
					</div>
				</div>
			</button>

			{trailingActions}

			{variant === "desktop" ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label={t("microAppsPage.actions.more")}
							data-testid={`${testId}-more`}
							className={cn(
								"absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg border border-border/40 bg-card/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur-md transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100 motion-reduce:transition-none",
								compact && "right-1 top-2",
								trailingActions &&
									"static shrink-0 border-transparent bg-transparent shadow-none backdrop-blur-none",
							)}
						>
							<MoreHorizontal className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						{menuActions.map((action) => (
							<DropdownMenuItem
								key={action.label}
								onSelect={action.onSelect}
								disabled={action.disabled}
								variant={action.destructive ? "destructive" : "default"}
							>
								<action.icon className="size-4" />
								{action.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}

			{variant === "mobile" ? (
				<button
					type="button"
					className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-md active:bg-muted"
					aria-label={t("microAppsPage.actions.more")}
					onClick={(event) => {
						event.stopPropagation()
						setMobileMenuOpen(true)
					}}
					data-testid={`${testId}-more`}
				>
					<MoreHorizontal className="size-4" />
				</button>
			) : null}
		</motion.div>
	)

	if (variant === "desktop") {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
				<ContextMenuContent className="w-44">
					{menuActions.map((action) => (
						<ContextMenuItem
							key={action.label}
							onSelect={action.onSelect}
							disabled={action.disabled}
							variant={action.destructive ? "destructive" : "default"}
						>
							<action.icon className="size-4" />
							{action.label}
						</ContextMenuItem>
					))}
				</ContextMenuContent>
			</ContextMenu>
		)
	}

	return (
		<>
			{card}
			<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
				<SheetContent
					side="bottom"
					showClose={false}
					aria-describedby={undefined}
					className="gap-0 rounded-t-[20px] border-0 bg-muted p-3"
				>
					<SheetTitle className="px-2 pb-3 pt-1 text-left text-base">{title}</SheetTitle>
					<div className="overflow-hidden rounded-2xl bg-card">
						{canRename ? (
							<button
								type="button"
								className="flex h-14 w-full items-center gap-3 px-4 text-left text-base active:bg-muted/60"
								onClick={() => {
									setMobileMenuOpen(false)
									onRename()
								}}
							>
								<Pencil className="size-4" />
								{t("microAppsPage.actions.rename")}
							</button>
						) : null}
						{canManageCollaborators && onManageCollaborators ? (
							<>
								<div className="ml-12 h-px bg-border/60" />
								<button
									type="button"
									className="flex h-14 w-full items-center gap-3 px-4 text-left text-base active:bg-muted/60 disabled:opacity-50"
									disabled={managingCollaborators}
									onClick={() => {
										setMobileMenuOpen(false)
										onManageCollaborators()
									}}
								>
									<Users className="size-4" />
									{t("microAppsPage.actions.manageCollaborators")}
								</button>
							</>
						) : null}
						{canDelete ? (
							<>
								<div className="ml-12 h-px bg-border/60" />
								<button
									type="button"
									className="flex h-14 w-full items-center gap-3 px-4 text-left text-base text-destructive active:bg-destructive/10"
									onClick={() => {
										setMobileMenuOpen(false)
										onDelete()
									}}
								>
									<Trash2 className="size-4" />
									{t("microAppsPage.actions.deleteApp")}
								</button>
							</>
						) : null}
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}
