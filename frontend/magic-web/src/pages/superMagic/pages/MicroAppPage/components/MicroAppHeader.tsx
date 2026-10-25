import { ArrowLeft, PenLine, Rocket, ShieldCheck, UserRoundPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { HTML_PERMISSION_ANCHOR_ATTRIBUTE } from "@/pages/superMagic/components/Detail/contents/HTML/components/PermissionManager/CodeChangeConfirmPopover"
import { useSharedHtmlAppPermissions } from "@/pages/superMagic/components/Detail/contents/HTML/hooks/HtmlAppPermissionContext"
import MicroAppModeSwitcher, { type MicroAppPageMode } from "./MicroAppModeSwitcher"

interface MicroAppHeaderProps {
	selectedProject: ProjectListItem | null
	hasEntries: boolean
	canPublish: boolean
	isPublished?: boolean
	onBack: () => void
	onPublish: () => void
	canEdit?: boolean
	onEdit?: () => void
	canManageCollaborators?: boolean
	onManageCollaborators?: () => void
	canManageHtmlPermissions?: boolean
	onManageHtmlPermissions?: () => void
	canUseDevelopment?: boolean
	pageMode?: MicroAppPageMode
	onPageModeChange?: (mode: MicroAppPageMode) => void
}

export default function MicroAppHeader({
	selectedProject,
	hasEntries,
	canPublish,
	isPublished = false,
	onBack,
	onPublish,
	canEdit,
	onEdit,
	canManageCollaborators,
	onManageCollaborators,
	canManageHtmlPermissions,
	onManageHtmlPermissions,
	canUseDevelopment = false,
	pageMode = "development",
	onPageModeChange,
}: MicroAppHeaderProps) {
	const { t } = useTranslation("super")
	const projectName = selectedProject?.project_name || t("project.unnamedProject")
	const publishButtonLabel = t(
		isPublished ? "microAppPage.publish.published" : "microAppPage.publish.button",
	)
	const showCollaboratorAction = Boolean(canManageCollaborators && onManageCollaborators)
	const showHtmlPermissionAction = Boolean(canManageHtmlPermissions && onManageHtmlPermissions)
	// The micro app permission controller is shared through context; a dot flags grants whose app
	// code changed after the user confirmed them.
	const htmlPermissionCodeChanged = Boolean(
		useSharedHtmlAppPermissions()?.htmlPermissionCodeChanged,
	)
	return (
		<header
			className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3"
			data-testid="micro-app-header"
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 shrink-0"
						onClick={onBack}
					>
						<ArrowLeft size={16} />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">{t("microAppPage.header.backToApps")}</TooltipContent>
			</Tooltip>

			<div className="min-w-0 flex-1">
				{canEdit && onEdit ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="-ml-2 h-8 max-w-full gap-1.5 px-2"
								onClick={onEdit}
								data-testid="micro-app-edit-button"
							>
								<span className="truncate text-sm font-medium">{projectName}</span>
								<PenLine className="size-3.5 shrink-0 text-muted-foreground" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{t("microAppPage.edit.button")}
						</TooltipContent>
					</Tooltip>
				) : (
					<p className="truncate text-sm font-medium text-foreground">{projectName}</p>
				)}
			</div>

			{showHtmlPermissionAction ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 shrink-0 gap-2"
							aria-label={t("htmlEditor.permissionManager.open")}
							data-testid="micro-app-permission-manager"
							{...{ [HTML_PERMISSION_ANCHOR_ATTRIBUTE]: "" }}
							onClick={() => onManageHtmlPermissions?.()}
						>
							<span className="relative inline-flex">
								<ShieldCheck size={14} />
								{htmlPermissionCodeChanged ? (
									<span
										role="img"
										aria-label={t(
											"htmlEditor.permissionManager.codeChangedDot",
										)}
										className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500 ring-2 ring-background"
										data-testid="micro-app-permission-code-changed-dot"
									/>
								) : null}
							</span>
							{t("htmlEditor.permissionManager.open")}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("htmlEditor.permissionManager.open")}
					</TooltipContent>
				</Tooltip>
			) : null}

			{canUseDevelopment && onPageModeChange ? (
				<MicroAppModeSwitcher value={pageMode} onChange={onPageModeChange} />
			) : null}

			{showCollaboratorAction ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="size-7 shrink-0"
							aria-label={t("project.addCollaborators")}
							data-testid="micro-app-manage-collaborators"
							onClick={() => onManageCollaborators?.()}
						>
							<UserRoundPlus size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">{t("project.addCollaborators")}</TooltipContent>
				</Tooltip>
			) : null}

			{hasEntries && canPublish ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							size="sm"
							className="h-7 shrink-0 gap-2"
							onClick={onPublish}
							data-testid="micro-app-publish-button"
						>
							<Rocket size={14} />
							{publishButtonLabel}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("microAppPage.publish.buttonTooltip")}
					</TooltipContent>
				</Tooltip>
			) : null}
		</header>
	)
}
