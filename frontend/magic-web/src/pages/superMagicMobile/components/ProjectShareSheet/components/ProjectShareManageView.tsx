import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { ShareExtendInfo } from "@/pages/superMagic/components/ShareManagement/types"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { formatRelativeTime } from "@/utils/string"
import type { ProjectShareSheetController } from "../types"
import { getShareTypeVisualMeta } from "../utils/shareTypeVisual"

interface ProjectShareManageViewProps {
	controller: ProjectShareSheetController
}

function getDefaultTitleKey(shareType: ShareType) {
	if (shareType === ShareType.Public) {
		return "projectShare.defaultNamePublic"
	}

	if (shareType === ShareType.Organization) {
		return "projectShare.defaultNameOrganization"
	}

	return "projectShare.defaultNamePassword"
}

function formatManageCreatedAt(value?: string) {
	if (!value) return ""
	return value
}

function getOrganizationSummary(
	shareExtend: ShareExtendInfo | undefined,
	t: (key: string, values?: Record<string, unknown>) => string,
) {
	const userCount = shareExtend?.user_count || 0
	const departmentCount = shareExtend?.department_count || 0

	if (userCount > 0 && departmentCount > 0) {
		return t("projectShare.manageOrganizationMembersAndDepartments", {
			userCount,
			departmentCount,
		})
	}

	if (userCount > 0) {
		return t("projectShare.manageOrganizationMembersOnly", { userCount })
	}

	if (departmentCount > 0) {
		return t("projectShare.manageOrganizationDepartmentsOnly", { departmentCount })
	}

	return t("projectShare.manageOrganizationSummary")
}

/**
 * 根据分享类型生成列表图标与摘要，管理页只展示入口，不在列表内承载旧操作按钮。
 */
function getManageItemMeta(
	shareExtend: ShareExtendInfo | undefined,
	shareType: ShareType,
	t: (key: string, values?: Record<string, unknown>) => string,
) {
	const visualMeta = getShareTypeVisualMeta(shareType)

	if (shareType === ShareType.Public) {
		return {
			Icon: visualMeta.Icon,
			summary: t("projectShare.managePublicSummary"),
			className: visualMeta.iconClassName,
		}
	}

	if (shareType === ShareType.Organization) {
		return {
			Icon: visualMeta.Icon,
			summary: getOrganizationSummary(shareExtend, t),
			className: visualMeta.iconClassName,
		}
	}

	return {
		Icon: visualMeta.Icon,
		summary: t("projectShare.managePasswordSummary"),
		className: visualMeta.iconClassName,
	}
}

/**
 * 管理页使用原型的单一卡片列表；复制、编辑、删除等动作统一收敛到详情页。
 */
export default function ProjectShareManageView({ controller }: ProjectShareManageViewProps) {
	const { t, i18n } = useTranslation("super")

	if (controller.loading) {
		return (
			<div
				className="min-h-70 flex items-center justify-center text-sm text-muted-foreground"
				data-testid="project-share-sheet-manage-loading"
			>
				{t("common.loading")}
			</div>
		)
	}

	if (controller.filteredShareItems.length === 0) {
		return (
			<div
				className="min-h-70 flex items-center justify-center text-sm text-muted-foreground"
				data-testid="project-share-sheet-manage-empty"
			>
				{t("projectShare.empty")}
			</div>
		)
	}

	return (
		<div
			className="overflow-hidden rounded-[14px] bg-white"
			data-testid="project-share-sheet-manage-list"
		>
			{controller.filteredShareItems.map((item, index) => {
				const meta = getManageItemMeta(item.share_extend, item.share_type, t)
				const Icon = meta.Icon
				const createdAt = formatRelativeTime(i18n.language)(
					formatManageCreatedAt(item.created_at),
				)

				return (
					<div key={item.resource_id}>
						{index > 0 ? <div className="mx-3.5 h-px bg-border" /> : null}
						<button
							type="button"
							className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left active:opacity-75"
							onClick={() => controller.goToLinkDetail(item.resource_id)}
							data-testid="project-share-sheet-manage-row"
						>
							<div
								className={cn(
									"flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
									meta.className,
								)}
							>
								<Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-[16px] font-medium leading-5 text-foreground">
									{item.title || t(getDefaultTitleKey(item.share_type))}
								</div>
								<div className="mt-1 truncate text-[13px] leading-4 text-muted-foreground">
									{meta.summary}
								</div>
							</div>
							{createdAt ? (
								<div className="shrink-0 text-[13px] leading-4 text-muted-foreground">
									{createdAt}
								</div>
							) : null}
						</button>
					</div>
				)
			})}
		</div>
	)
}
