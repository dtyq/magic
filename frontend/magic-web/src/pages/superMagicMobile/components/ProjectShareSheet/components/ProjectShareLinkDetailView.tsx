import { useState } from "react"
import { Building2, Eye, EyeOff, UserRound } from "lucide-react"
import { NodeType } from "@dtyq/user-selector"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import { formatRelativeTime } from "@/utils/string"
import type { ProjectShareSheetController } from "../types"
import { isOrganizationShareScopeAll } from "@/pages/superMagic/components/ShareManagement/utils/shareScopeSummary"
import { isPartialFileShare } from "../utils/shareScope"
import {
	buildDetailMetaLabel,
	getShareTypeDescriptionKey,
	getShareTypeVisualMeta,
} from "../utils/shareTypeVisual"
import SelectedFilesHierarchySection from "./SelectedFilesHierarchySection"
import { ProjectShareScrollSpacer } from "./ProjectShareFloatingActionBar"

interface ProjectShareLinkDetailViewProps {
	controller: ProjectShareSheetController
}

/**
 * 详情页只使用现有分享字段展示链接和密码，不为了贴近原型补造接口没有返回的数据。
 */
export default function ProjectShareLinkDetailView({
	controller,
}: ProjectShareLinkDetailViewProps) {
	const { t, i18n } = useTranslation("super")
	const [isPasswordVisible, setIsPasswordVisible] = useState(false)
	const share = controller.selectedShare

	if (!share) {
		return (
			<div
				className="min-h-70 flex items-center justify-center text-sm text-muted-foreground"
				data-testid="project-share-sheet-detail-empty"
			>
				{t("projectShare.detailUnavailable")}
			</div>
		)
	}

	const shareUrl = generateShareUrl(share.resource_id, share.password, "files")
	const visualMeta = getShareTypeVisualMeta(share.share_type)
	const TypeIcon = visualMeta.Icon
	const createdAtLabel = formatRelativeTime(i18n.language)(share.created_at)
	const detailMetaLabel = buildDetailMetaLabel({ share, createdAtLabel, t })
	// Show selected files only for partial file shares; hide for whole-project shares even when opened from the file list entry.
	const shouldShowSelectedFiles = controller.selectedFileCount > 0 && isPartialFileShare(share)
	const detailMemberNodes = controller.detailMemberNodes || []
	const isAllOrganizationScope = isOrganizationShareScopeAll(share.share_scope)
	const shouldShowOrganizationMembers =
		share.share_type === ShareType.Organization &&
		(isAllOrganizationScope || detailMemberNodes.length > 0)

	return (
		<div className="flex flex-col gap-2" data-testid="project-share-sheet-detail-view">
			<section
				className={cn("flex items-start gap-3 rounded-lg p-4", visualMeta.cardClassName)}
				data-testid="project-share-sheet-detail-type-card"
			>
				<div
					className={cn(
						"flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
						visualMeta.iconClassName,
					)}
				>
					<TypeIcon className="h-5 w-5" strokeWidth={1.8} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-[15px] font-medium leading-5 text-foreground">
						{t(getShareTypeDescriptionKey(share.share_type))}
					</div>
					<div className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">
						{detailMetaLabel}
					</div>
				</div>
			</section>

			<section className="space-y-2">
				<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">
					{t("projectShare.linkLabel")}
				</div>
				<div
					className="flex h-12 items-center rounded-lg bg-white px-3.5"
					data-testid="project-share-sheet-detail-link-card"
				>
					<div className="truncate font-mono text-[15px] leading-5 text-foreground">
						{shareUrl}
					</div>
				</div>
			</section>

			{shouldShowOrganizationMembers ? (
				<section
					className="space-y-2"
					data-testid="project-share-sheet-detail-members-section"
				>
					<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">
						{t("projectShare.organizationMembersLabel")}
					</div>
					<div className="overflow-hidden rounded-lg bg-white">
						{isAllOrganizationScope ? (
							<div
								className="flex h-12 items-center px-3.5"
								data-testid="project-share-sheet-detail-member-row-all"
							>
								<div className="min-w-0 flex-1 truncate text-[16px] leading-5 text-foreground">
									{t("projectShare.shareScopeAllMembers")}
								</div>
							</div>
						) : (
							detailMemberNodes.map((member) => {
								const isUser =
									member.type === "User" || member.dataType === NodeType.User
								const MemberIcon = isUser ? UserRound : Building2

								return (
									<div
										key={member.id}
										className="flex h-12 items-center gap-2.5 border-b border-[#F1F1F1] px-3.5 last:border-b-0"
										data-testid={`project-share-sheet-detail-member-row-${member.id}`}
									>
										<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
											<MemberIcon className="h-4 w-4" strokeWidth={1.8} />
										</div>
										<div className="min-w-0 flex-1 truncate text-[16px] leading-5 text-foreground">
											{member.name}
										</div>
									</div>
								)
							})
						)}
					</div>
				</section>
			) : null}

			{share.password ? (
				<section className="space-y-2">
					<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">
						{t("share.accessPassword")}
					</div>
					<div className="flex h-12 items-center gap-2 rounded-lg bg-white px-3.5">
						<div
							className="min-w-0 flex-1 truncate font-mono text-[16px] tracking-widest text-foreground"
							data-testid="project-share-sheet-password-value"
						>
							{isPasswordVisible ? share.password : "• • • • • •"}
						</div>
						<button
							type="button"
							onClick={() => setIsPasswordVisible((value) => !value)}
							className="shrink-0 p-1 text-muted-foreground active:opacity-60"
							aria-label={
								isPasswordVisible
									? t("share.hidePassword")
									: t("share.showPassword")
							}
							data-testid="project-share-sheet-password-visibility-button"
						>
							{isPasswordVisible ? (
								<EyeOff className="h-[18px] w-[18px]" />
							) : (
								<Eye className="h-[18px] w-[18px]" />
							)}
						</button>
						<button
							type="button"
							onClick={controller.copySelectedSharePassword}
							className="shrink-0 whitespace-nowrap text-[14px] font-medium text-primary active:opacity-70"
							data-testid="project-share-sheet-copy-password-button"
						>
							{t("share.copyPassword")}
						</button>
					</div>
				</section>
			) : null}

			{shouldShowSelectedFiles ? (
				<section className="space-y-2">
					<SelectedFilesHierarchySection
						hierarchy={controller.selectedFileHierarchy}
						totalCount={controller.selectedFileCount}
						testId="project-share-sheet-selected-files-trigger"
					/>
				</section>
			) : null}

			<ProjectShareScrollSpacer
				variant="dual"
				testId="project-share-sheet-detail-floating-bar"
			/>
		</div>
	)
}
