import { Check, Settings, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ProjectShareSheetController } from "../types"

interface ProjectShareSheetHeaderProps {
	controller: ProjectShareSheetController
	projectName?: string
}

/**
 * 原型风格头部：左侧统一承接返回/关闭，右侧只在创建页和确认页提供上下文动作。
 */
export default function ProjectShareSheetHeader({
	controller,
	projectName,
}: ProjectShareSheetHeaderProps) {
	const { t } = useTranslation("super")
	// 链接详情标题：与下方 `t("...")` 同属一次 `useTranslation`，便于静态扫描；不把 `t` 作为参数传给其它函数。
	const linkDetailTitle = (() => {
		const share = controller.selectedShare
		if (!share) {
			return t("projectShare.linkDetailTitle")
		}

		const rawTitle = share.title || ""
		const hasTemplateMarker = rawTitle.includes("{{")
		if (!hasTemplateMarker && rawTitle.trim()) {
			return rawTitle
		}

		if (controller.mode === "file" || ("file_ids" in share && Array.isArray(share.file_ids))) {
			const fileCount = share.extend?.file_count || controller.selectedFileCount
			const mainFileName =
				("main_file_name" in share && share.main_file_name) ||
				controller.selectedFileHierarchy[0]?.name ||
				t("share.untitled")

			if (fileCount <= 1) {
				return t("share.singleFileShareName", {
					fileName: mainFileName,
				})
			}

			return t("share.multiFileShareName", {
				mainFileName,
				count: fileCount,
			})
		}

		return rawTitle.trim() || t("projectShare.linkDetailTitle")
	})()
	const canGoBack = controller.viewStack.length > 0
	const titleMap: Record<typeof controller.view, string> = {
		create:
			controller.mode === "file"
				? t("projectShare.fileModeCreateTitle")
				: t("projectShare.createTitle"),
		manage: t("projectShare.manageTitle"),
		linkDetail: linkDetailTitle,
		expiry: t("projectShare.expiryTitle"),
		deleteConfirm: t("projectShare.deleteConfirmTitle"),
	}

	return (
		<div
			className="mobile-popup-action-header relative flex h-14 shrink-0 items-center justify-center px-16 py-2"
			data-testid="project-share-sheet-header"
		>
			<button
				type="button"
				className="absolute left-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-[0_8px_25px_rgba(0,0,0,0.10)] active:opacity-70"
				onClick={canGoBack ? controller.goBack : controller.close}
				aria-label={canGoBack ? t("common.back") : t("common.close")}
				data-testid="project-share-sheet-back-button"
			>
				<X className="h-[22px] w-[22px]" />
			</button>
			<div className="flex min-w-0 flex-col items-center">
				<div className="max-w-[247px] truncate text-center text-[18px] font-medium leading-6 text-foreground">
					{titleMap[controller.view]}
				</div>
				{projectName &&
				(controller.view === "create" || controller.view === "linkDetail") ? (
					<div className="mt-0.5 max-w-[247px] truncate text-center text-[12px] leading-4 text-muted-foreground">
						{projectName}
					</div>
				) : null}
			</div>
			{controller.view === "create" ? (
				<button
					type="button"
					className="absolute right-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-[0_8px_25px_rgba(0,0,0,0.10)] active:opacity-70"
					onClick={controller.goToManage}
					aria-label={t("projectShare.manageTitle")}
					data-testid="project-share-sheet-manage-button"
				>
					<Settings className="h-[22px] w-[22px]" />
				</button>
			) : null}
			{controller.view === "deleteConfirm" ? (
				<button
					type="button"
					className="absolute right-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-[0_8px_25px_rgba(0,0,0,0.10)] active:opacity-80"
					onClick={controller.confirmCancelShare}
					aria-label={t("common.confirm")}
					data-testid="project-share-sheet-delete-confirm-button"
				>
					<Check className="h-[22px] w-[22px]" />
				</button>
			) : null}
		</div>
	)
}
