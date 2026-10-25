import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import dayjs from "@/infrastructure/vendors/dayjs"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import ProjectTypeTag from "@/pages/superMagic/components/ProjectTypeTag"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { MagiClawTemplateAvatar } from "@/pages/superMagic/pages/MagiClawPage/MagiClawTemplateAvatar"
import { MagiClawStatusBadge } from "@/pages/superMagic/pages/MagiClawPage/MagiClawStatusBadge"
import MicroAppCardCover from "@/pages/superMagic/pages/MicroAppsPage/components/MicroAppCardCover"
import { IconWorkspaceProjectFolderIcon } from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import { cn } from "@/utils/cn"
import { getResourceProjectType, type ResourceProject } from "../../resourceProjectTypes"

const metadataBadgeClassName =
	"min-h-5 max-w-full rounded-md px-1.5 py-0 text-xs font-normal leading-4"

/** 最近项目只带项目类型时，沿用各模块已有默认图标；有资源图片时使用同一展示。 */
export function ProjectResourceIcon({ project }: { project: ResourceProject }) {
	const iconClassName = "size-8 shrink-0 rounded-lg"

	switch (project.resourceType ?? getResourceProjectType(project)) {
		case "claw":
			return (
				<MagiClawTemplateAvatar
					templateCode={project.resourceTemplateCode as "openclaw" | "magishock" | null}
					src={project.resourceIcon}
					className={cn(iconClassName, "border border-border")}
				/>
			)
		case "micro-app":
			return (
				<MicroAppCardCover
					id={project.resourceId || project.micro_app_id || project.id}
					coverUrl={project.resourceCoverUrl ?? undefined}
					compact
					variant="icon"
				/>
			)
		case "skill":
			return (
				<SkillThumbnail
					src={project.resourceIcon}
					alt={project.project_name || ""}
					resetKey={project.resourceId}
					iconSize={24}
					className={iconClassName}
				/>
			)
		case "agent":
			return (
				<div
					className={cn(
						iconClassName,
						"flex items-center justify-center bg-muted text-muted-foreground",
					)}
				>
					{project.resourceIcon ? (
						<img
							src={project.resourceIcon}
							alt=""
							className="size-full rounded-lg object-cover"
						/>
					) : (
						<CrewFallbackAvatar iconSize={22} />
					)}
				</div>
			)
		default:
			return <IconWorkspaceProjectFolderIcon size={32} />
	}
}

function ResourceStatus({ project }: { project: ResourceProject }) {
	const { t } = useTranslation("super")
	if (project.resourceType === "claw") {
		return (
			<MagiClawStatusBadge
				status={project.resourceStatus}
				className={cn(metadataBadgeClassName, "h-auto [&>span:first-child]:size-1.5")}
			/>
		)
	}
	if (project.resourceType === "micro-app") {
		const label =
			project.resourceStatus === "published"
				? t("microAppsPage.statusPublished")
				: project.resourceStatus === "unpublished"
					? t("microAppsPage.statusUnpublished")
					: t("projectResources.statusUnknown")
		return (
			<Badge
				variant="outline"
				className={cn(
					metadataBadgeClassName,
					"border-border bg-muted/30 text-foreground/80",
				)}
			>
				{label}
			</Badge>
		)
	}
	return null
}

/** 桌面卡片和 H5 项目行共用已加载的信息；选择、进入和请求仍由各自入口负责。 */
export function ProjectResourceInfo({
	project,
	name,
	mobile = false,
	list = false,
	icon,
	titleTrailing,
}: {
	project: ResourceProject
	name: string
	mobile?: boolean
	list?: boolean
	icon?: ReactNode
	titleTrailing?: ReactNode
}) {
	const { t, i18n } = useTranslation("super")
	const description = project.resourceDescription?.trim() || project.project_description?.trim()
	const role = project.resourceRole?.trim()
	const packageName = project.resourcePackageName?.trim()
	const updatedDate =
		project.updated_at && dayjs(project.updated_at).isValid()
			? dayjs(project.updated_at).locale(i18n.language.startsWith("zh") ? "zh-cn" : "en")
			: undefined
	const hasStatus = project.resourceType === "claw" || project.resourceType === "micro-app"
	const showRole = Boolean(role && role !== description && role !== name)
	const showPackageName = Boolean(packageName && packageName !== name)
	const hasMetadata =
		hasStatus || showRole || showPackageName || project.resourceVersion || updatedDate

	return (
		<div
			className={cn(
				"flex min-w-0 flex-1 items-start gap-2 [container-type:inline-size]",
				!list && !mobile && "h-full",
			)}
			data-testid="project-resource-info"
		>
			{icon ?? <ProjectResourceIcon project={project} />}
			{/* 按卡片可用宽度折行，避免窄面板把名称挤到只剩图标。 */}
			<div
				className={cn(
					"grid min-w-0 flex-1 grid-cols-1 items-center gap-x-4 gap-y-1",
					// 网格中名称靠顶、元信息靠底；列表仍随实际内容自然增高。
					!list && !mobile && "content-between self-stretch",
					list &&
						!mobile &&
						"[@container_(min-width:600px)]:grid-cols-[minmax(0,1fr)_auto]",
				)}
			>
				<div className="flex min-w-0 flex-col gap-0.5">
					<div className="flex min-w-0 items-start gap-1.5">
						<SmartTooltip
							className="min-w-0 text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]"
							maxLines={2}
							align="start"
							disabled={mobile}
						>
							{name}
						</SmartTooltip>
						<div className="flex shrink-0 items-center gap-1.5 pt-0.5">
							<ProjectTypeTag projectMode={project.project_mode} tooltipDisabled />
							{titleTrailing}
						</div>
					</div>
					{description && (
						<SmartTooltip
							className="min-w-0 text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]"
							maxLines={2}
							align="start"
							disabled={mobile}
						>
							{description}
						</SmartTooltip>
					)}
				</div>
				{hasMetadata && (
					// 状态与版本用 Tag 区分字段，时间保留文字；窄屏按字段换行，不把整个元信息排成一个长句。
					<div
						className={cn(
							"flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-muted-foreground",
							list &&
								!mobile &&
								"[@container_(min-width:600px)]:max-w-72 [@container_(min-width:600px)]:justify-end",
						)}
					>
						{hasStatus && <ResourceStatus project={project} />}
						{showRole && (
							<SmartTooltip
								className="max-w-full text-xs leading-4"
								maxLines={2}
								align="start"
								disabled={mobile}
							>
								{t("projectResources.role", { role })}
							</SmartTooltip>
						)}
						{showPackageName && (
							<Badge
								variant="secondary"
								className={cn(
									metadataBadgeClassName,
									"min-w-0 whitespace-normal bg-muted/50 text-muted-foreground",
								)}
							>
								<SmartTooltip
									elementType="span"
									className="min-w-0 max-w-full break-all text-xs leading-4"
									maxLines={2}
									align="start"
									disabled={mobile}
								>
									{packageName}
								</SmartTooltip>
							</Badge>
						)}
						{project.resourceVersion && (
							<Badge
								variant="secondary"
								className={cn(
									metadataBadgeClassName,
									"whitespace-normal break-all text-muted-foreground",
								)}
							>
								{t("projectResources.version", {
									version: project.resourceVersion,
								})}
							</Badge>
						)}
						{updatedDate && (
							<MagicTooltip title={updatedDate.format("YYYY/MM/DD HH:mm [UTC]Z")}>
								<span className="shrink-0">
									{t("projectResources.updatedAt", {
										date: updatedDate.fromNow(),
									})}
								</span>
							</MagicTooltip>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
