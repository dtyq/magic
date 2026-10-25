import { ArrowLeft, Database, PenLine, Rocket, UserRoundPlus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

interface MicroAppMobileHeaderProps {
	selectedProject: ProjectListItem | null
	hasEntries: boolean
	canPublish: boolean
	isPublished?: boolean
	isDatabasePanelOpen: boolean
	onBack: () => void
	onToggleDatabasePanel: () => void
	onPublish: () => void
	canEdit?: boolean
	onEdit?: () => void
	canManageCollaborators?: boolean
	onManageCollaborators?: () => void
}

/** 移动端详情头部保留返回、项目名和主要动作，模式切换放在独立的二级栏。 */
export default function MicroAppMobileHeader({
	selectedProject,
	hasEntries,
	canPublish,
	isPublished = false,
	isDatabasePanelOpen,
	onBack,
	onToggleDatabasePanel,
	onPublish,
	canEdit,
	onEdit,
	canManageCollaborators,
	onManageCollaborators,
}: MicroAppMobileHeaderProps) {
	const { t } = useTranslation("super")
	const projectName = selectedProject?.project_name || t("project.unnamedProject")
	const publishButtonLabel = t(
		isPublished ? "microAppPage.publish.published" : "microAppPage.publish.button",
	)

	return (
		<header
			className="mobile-page-header shrink-0 border-b border-border"
			data-testid="micro-app-mobile-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-9 shrink-0"
				onClick={onBack}
				aria-label={t("microAppPage.header.backToApps")}
			>
				<ArrowLeft className="size-[18px]" aria-hidden />
			</Button>

			<div className="min-w-0 flex-1">
				{canEdit && onEdit ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-9 max-w-full justify-start gap-1.5 px-1"
						onClick={onEdit}
						data-testid="micro-app-mobile-edit-button"
					>
						<span className="truncate text-base font-medium">{projectName}</span>
						<PenLine className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
					</Button>
				) : (
					<p className="truncate px-1 text-base font-medium text-foreground">
						{projectName}
					</p>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-0.5">
				<Button
					type="button"
					variant={isDatabasePanelOpen ? "secondary" : "ghost"}
					size="icon"
					className="size-9"
					onClick={onToggleDatabasePanel}
					disabled={!selectedProject?.id}
					aria-label={
						isDatabasePanelOpen
							? t("microAppPage.header.hideDatabase")
							: t("microAppPage.header.showDatabase")
					}
					data-testid="micro-app-mobile-database-button"
				>
					<Database className="size-4" aria-hidden />
				</Button>

				{canManageCollaborators && onManageCollaborators ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9"
						onClick={onManageCollaborators}
						aria-label={t("project.addCollaborators")}
						data-testid="micro-app-mobile-manage-collaborators"
					>
						<UserRoundPlus className="size-4" aria-hidden />
					</Button>
				) : null}

				{hasEntries && canPublish ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 text-primary"
						onClick={onPublish}
						aria-label={publishButtonLabel}
						data-testid="micro-app-mobile-publish-button"
					>
						<Rocket className="size-4" aria-hidden />
					</Button>
				) : null}
			</div>
		</header>
	)
}
