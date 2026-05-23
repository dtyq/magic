import { useState } from "react"
import { Eye, EyeOff, Globe, Lock, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import type { ProjectShareSheetController } from "../types"
import { isPartialFileShare } from "../utils/shareScope"
import SelectedFilesHierarchySection from "./SelectedFilesHierarchySection"
import { ProjectShareScrollSpacer } from "./ProjectShareFloatingActionBar"

interface ProjectShareLinkDetailViewProps {
	controller: ProjectShareSheetController
}

/**
 * 根据分享类型选择图标与文案，让详情页保持原型的类型信息卡结构。
 */
function getShareTypeMeta(
	shareType: ShareType,
	t: (key: string, values?: Record<string, unknown>) => string,
) {
	if (shareType === ShareType.Public) {
		return {
			Icon: Globe,
			label: t("projectShare.typePublic"),
			description: t("projectShare.typePublicDescription"),
			className: "bg-blue-50 text-blue-600",
		}
	}

	if (shareType === ShareType.Organization) {
		return {
			Icon: Users,
			label: t("projectShare.typeOrganization"),
			description: t("projectShare.typeOrganizationDescription"),
			className: "bg-emerald-50 text-emerald-600",
		}
	}

	return {
		Icon: Lock,
		label: t("projectShare.typePassword"),
		description: t("projectShare.typePasswordDescription"),
		className: "bg-amber-50 text-amber-600",
	}
}

/**
 * 详情页只使用现有分享字段展示链接和密码，不为了贴近原型补造接口没有返回的数据。
 */
export default function ProjectShareLinkDetailView({
	controller,
}: ProjectShareLinkDetailViewProps) {
	const { t } = useTranslation("super")
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
	const meta = getShareTypeMeta(share.share_type, t)
	const TypeIcon = meta.Icon
	const fileCount = share.extend?.file_count || 1
	// Show selected files only for partial file shares; hide for whole-project shares even when opened from the file list entry.
	const shouldShowSelectedFiles = controller.selectedFileCount > 0 && isPartialFileShare(share)

	return (
		<div className="flex flex-col gap-2.5" data-testid="project-share-sheet-detail-view">
			<section
				className="flex items-start gap-3 rounded-[14px] bg-white p-4"
				data-testid="project-share-sheet-detail-type-card"
			>
				<div
					className={cn(
						"flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
						meta.className,
					)}
				>
					<TypeIcon className="h-5 w-5" strokeWidth={1.8} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-[15px] font-medium leading-5 text-foreground">
						{meta.label}
					</div>
					<div className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">
						{meta.description}
					</div>
					<div className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
						{share.expire_at ? share.expire_at : t("projectShare.expiresPermanent")} ·{" "}
						{t("projectShare.fileCount", { count: fileCount })}
					</div>
				</div>
			</section>

			<section className="space-y-2">
				<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">
					{t("projectShare.linkLabel")}
				</div>
				<div
					className="rounded-[14px] bg-white px-3.5 py-3"
					data-testid="project-share-sheet-detail-link-card"
				>
					<div className="break-all text-[15px] leading-5 text-foreground">
						{shareUrl}
					</div>
				</div>
			</section>

			{share.password ? (
				<section className="space-y-2">
					<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">
						{t("share.accessPassword")}
					</div>
					<div className="flex h-12 items-center gap-2 rounded-[14px] bg-white px-3.5">
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
