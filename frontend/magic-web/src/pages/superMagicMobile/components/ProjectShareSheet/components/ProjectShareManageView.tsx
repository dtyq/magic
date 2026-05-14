import { ChevronRight, Globe, Lock, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import type { ProjectShareSheetController } from "../types"

interface ProjectShareManageViewProps {
	controller: ProjectShareSheetController
}

/**
 * 根据分享类型生成列表图标与摘要，管理页只展示入口，不在列表内承载旧操作按钮。
 */
function getManageItemMeta(
	shareType: ShareType,
	t: (key: string, values?: Record<string, unknown>) => string,
) {
	if (shareType === ShareType.Public) {
		return {
			Icon: Globe,
			summary: t("projectShare.managePublicSummary"),
			className: "bg-blue-50 text-blue-600",
		}
	}

	if (shareType === ShareType.Organization) {
		return {
			Icon: Users,
			summary: t("projectShare.manageOrganizationSummary"),
			className: "bg-emerald-50 text-emerald-600",
		}
	}

	return {
		Icon: Lock,
		summary: t("projectShare.managePasswordSummary"),
		className: "bg-amber-50 text-amber-600",
	}
}

/**
 * 管理页使用原型的单一卡片列表；复制、编辑、删除等动作统一收敛到详情页。
 */
export default function ProjectShareManageView({ controller }: ProjectShareManageViewProps) {
	const { t } = useTranslation("super")

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
				const meta = getManageItemMeta(item.share_type, t)
				const Icon = meta.Icon
				const fileCount = item.extend?.file_count || 1

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
									{item.title || t("share.untitled")}
								</div>
								<div className="mt-1 truncate text-[13px] leading-4 text-muted-foreground">
									{meta.summary} ·{" "}
									{t("projectShare.fileCount", { count: fileCount })}
								</div>
								<div className="mt-1 text-[13px] leading-4 text-muted-foreground">
									{item.expire_at || t("projectShare.managePermanent")}
								</div>
							</div>
							<ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
						</button>
					</div>
				)
			})}
		</div>
	)
}
