import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import { Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { DeleteConfirmHierarchyGroup } from "../utils/mobileAttachmentTreeSelection"
import { summarizeDeleteConfirmHierarchy } from "../utils/mobileAttachmentTreeSelection"
import { TopicFileIcon } from "./TopicFileIcon"

interface FilesDeleteConfirmSheetProps {
	visible: boolean
	onClose: () => void
	onConfirm: () => void | Promise<void>
	selectedHierarchy: DeleteConfirmHierarchyGroup[]
	magicWarningVariant?: "none" | "single" | "multi"
	testIdPrefix?: string
}

/** Scrollable list with top/bottom fade masks (prototype FilesDeleteConfirmSheet). */
function DeleteConfirmScrollList({ children }: { children: React.ReactNode }) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [isAtTop, setIsAtTop] = useState(true)
	const [isAtBottom, setIsAtBottom] = useState(false)

	const checkScrollEdges = useCallback(() => {
		const element = scrollRef.current
		if (!element) return
		setIsAtTop(element.scrollTop <= 0)
		setIsAtBottom(element.scrollTop + element.clientHeight >= element.scrollHeight - 1)
	}, [])

	useEffect(() => {
		checkScrollEdges()
	}, [checkScrollEdges, children])

	return (
		<div
			ref={scrollRef}
			onScroll={checkScrollEdges}
			className="min-h-0 flex-1 overflow-y-auto px-[14px] pb-3"
			style={{
				maskImage: `linear-gradient(to bottom, ${isAtTop ? "black" : "transparent"}, black ${isAtTop ? "0px" : "24px"}, black ${isAtBottom ? "100%" : "calc(100% - 24px)"}, ${isAtBottom ? "black" : "transparent"})`,
				WebkitMaskImage: `linear-gradient(to bottom, ${isAtTop ? "black" : "transparent"}, black ${isAtTop ? "0px" : "24px"}, black ${isAtBottom ? "100%" : "calc(100% - 24px)"}, ${isAtBottom ? "black" : "transparent"})`,
			}}
		>
			{children}
		</div>
	)
}

/**
 * Batch delete confirmation sheet for project-detail / chat-sheet mobile file UI.
 */
export function FilesDeleteConfirmSheet({
	visible,
	onClose,
	onConfirm,
	selectedHierarchy,
	magicWarningVariant = "none",
	testIdPrefix = "mobile-files-batch-delete-confirm",
}: FilesDeleteConfirmSheetProps) {
	const { t } = useTranslation("super")

	const { folderGroups, rootFiles, emptyFolders, totalCount } = useMemo(
		() => summarizeDeleteConfirmHierarchy(selectedHierarchy),
		[selectedHierarchy],
	)

	const magicWarningKey =
		magicWarningVariant === "single"
			? "projectDetail.deleteConfirm.magicWarningSingle"
			: magicWarningVariant === "multi"
				? "projectDetail.deleteConfirm.magicWarningMulti"
				: null

	const rowCount = folderGroups.length + (rootFiles.length > 0 ? 1 : 0) + emptyFolders.length

	async function handleConfirm() {
		await onConfirm()
		onClose()
	}

	return (
		<MagicPopup
			visible={visible}
			onClose={onClose}
			position="bottom"
			headerVariant="actionHeader"
			headerTitle={t("projectDetail.deleteConfirm.title")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("common.cancel"),
				onClick: onClose,
				testId: `${testIdPrefix}-cancel`,
			}}
			headerTrailingAction={{
				icon: <Trash2 />,
				ariaLabel: t("topicFiles.contextMenu.delete"),
				onClick: () => {
					void handleConfirm()
				},
				tone: "destructive",
				testId: `${testIdPrefix}-confirm`,
			}}
			className="bg-muted"
			bodyClassName="flex max-h-[92dvh] min-h-0 flex-col overflow-hidden rounded-t-[14px] border-0 p-0"
			withSafeBottom={false}
		>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="shrink-0 px-[14px] pb-3 pt-[10px]">
					<p className="text-[16px] leading-6 text-muted-foreground">
						{t("projectDetail.deleteConfirm.intro", { count: totalCount })}
					</p>
				</div>

				<DeleteConfirmScrollList>
					{rowCount > 0 ? (
						<div className="overflow-hidden rounded-lg bg-card">
							{folderGroups.map((group, index) => (
								<div key={group.folder.id}>
									{index > 0 ? <div className="h-px w-full bg-border" /> : null}
									<div className="flex min-h-[48px] items-center gap-3 px-[14px] py-3">
										<TopicFileIcon
											isDirectory
											className="size-[18px] shrink-0"
										/>
										<span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-5 text-foreground">
											{group.folder.name}
										</span>
										<span className="shrink-0 text-[14px] leading-5 text-muted-foreground">
											{t("projectDetail.deleteConfirm.fileCount", {
												count: group.files.length,
											})}
										</span>
									</div>
								</div>
							))}

							{emptyFolders.map((folder, index) => (
								<div key={folder.id}>
									{(folderGroups.length > 0 || index > 0) && (
										<div className="h-px w-full bg-border" />
									)}
									<div className="flex min-h-[48px] items-center gap-3 px-[14px] py-3">
										<TopicFileIcon
											isDirectory
											className="size-[18px] shrink-0 opacity-50"
										/>
										<span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-5 text-foreground">
											{folder.name}
										</span>
										<span className="shrink-0 text-[14px] leading-5 text-muted-foreground">
											{t("projectDetail.deleteConfirm.emptyLabel")}
										</span>
									</div>
								</div>
							))}

							{rootFiles.length > 0 ? (
								<div>
									{(folderGroups.length > 0 || emptyFolders.length > 0) && (
										<div className="h-px w-full bg-border" />
									)}
									<div className="flex min-h-[48px] items-center gap-3 px-[14px] py-3">
										<TopicFileIcon
											fileExtension={rootFiles[0].fileExtension}
											className="size-[18px] shrink-0"
										/>
										<span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-5 text-foreground">
											{rootFiles.length === 1
												? rootFiles[0].name
												: t("projectDetail.deleteConfirm.rootFiles", {
														count: rootFiles.length,
													})}
										</span>
									</div>
								</div>
							) : null}
						</div>
					) : null}
				</DeleteConfirmScrollList>

				<div
					className={cn("shrink-0 px-[14px] pt-2")}
					style={{ paddingBottom: "max(var(--safe-area-inset-bottom), 16px)" }}
				>
					{magicWarningKey ? (
						<div className="rounded-lg bg-destructive/10 px-3 py-2.5">
							<p className="text-[14px] leading-5 text-destructive">
								{t(magicWarningKey)}
							</p>
						</div>
					) : (
						<p className="text-[14px] leading-5 text-destructive/80">
							{t("projectDetail.deleteConfirm.warning")}
						</p>
					)}
				</div>
			</div>
		</MagicPopup>
	)
}
