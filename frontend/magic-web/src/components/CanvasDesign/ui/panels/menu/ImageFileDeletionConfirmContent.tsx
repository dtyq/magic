import { useId, useState, type ReactElement } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { CanvasDesignI18nProvider, useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { I18nConfig } from "../../../app/providers/I18nProvider"

export type ImageFileDeletionScope = "current" | "all"

// 宿主的命令式弹窗独立挂载，使用画布原有翻译上下文，不依赖弹窗所在的 React 树。
export function renderImageFileDeletionConfirmContent(
	props: ImageFileDeletionConfirmContentProps,
	i18n: I18nConfig | undefined,
): ReactElement {
	return (
		<CanvasDesignI18nProvider {...i18n}>
			<ImageFileDeletionConfirmContent {...props} />
		</CanvasDesignI18nProvider>
	)
}

interface ImageFileDeletionConfirmContentProps {
	versionCount: number
	currentFileShared: boolean
	allVersionsShared: boolean
	onScopeChange: (scope: ImageFileDeletionScope) => void
	processing: boolean
}

export function ImageFileDeletionConfirmContent({
	versionCount,
	currentFileShared,
	allVersionsShared,
	onScopeChange,
	processing,
}: ImageFileDeletionConfirmContentProps) {
	const { t } = useCanvasDesignI18n()
	const groupId = useId()
	const [scope, setScope] = useState<ImageFileDeletionScope>("current")
	const currentDescription = currentFileShared
		? t(
				"menu.deleteCurrentImageSharedDescription",
				"此图片文件仍被其它内容引用，本次只移除当前版本，文件保留",
			)
		: t(
				"menu.deleteCurrentImageDescription",
				"从画布移除当前版本，并删除对应图片文件；保留其它版本",
			)

	return (
		<span className="flex flex-col gap-3 text-left text-sm">
			<span>
				{versionCount > 1
					? t("menu.deleteImageVersionsContent", {
							defaultValue: "这张图片包含 {{count}} 个版本，请选择处理范围。",
							count: versionCount,
						})
					: currentFileShared
						? currentDescription
						: t(
								"menu.deleteImageFileContent",
								"这张图片会从画布移除，对应图片文件也会从项目中删除。",
							)}
			</span>
			{versionCount > 1 && (
				<RadioGroup
					asChild
					value={scope}
					disabled={processing}
					aria-label={t("menu.deleteImageScope", "处理范围")}
					onValueChange={(value) => {
						if (value !== "current" && value !== "all") return
						setScope(value)
						onScopeChange(value)
					}}
				>
					<span className="grid gap-3">
						<label
							htmlFor={`${groupId}-current`}
							className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary"
						>
							<RadioGroupItem
								id={`${groupId}-current`}
								value="current"
								className="mt-0.5"
							/>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="font-medium text-foreground">
									{t("menu.deleteCurrentImageVersion", "仅当前版本")}
								</span>
								<span className="text-xs text-muted-foreground">
									{currentDescription}
								</span>
							</span>
						</label>
						<label
							htmlFor={`${groupId}-all`}
							className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:disabled]:cursor-not-allowed has-[[data-state=checked]]:border-primary has-[:disabled]:opacity-60"
						>
							<RadioGroupItem
								id={`${groupId}-all`}
								value="all"
								disabled={allVersionsShared}
								className="mt-0.5"
							/>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="font-medium text-foreground">
									{t("menu.deleteAllImageVersions", {
										defaultValue: "全部 {{count}} 个版本",
										count: versionCount,
									})}
								</span>
								<span className="text-xs text-muted-foreground">
									{allVersionsShared
										? t(
												"menu.deleteImageVersionsShared",
												"仍有其它画布元素引用这些文件，请先处理其它引用",
											)
										: t(
												"menu.deleteAllImagesDescription",
												"从画布移除整个图片元素，并删除全部对应图片文件",
											)}
								</span>
							</span>
						</label>
					</span>
				</RadioGroup>
			)}
			{!(scope === "current" && currentFileShared) && (
				<span className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
					{t(
						"menu.deleteImageRecoveryTip",
						"删除的图片文件会移入回收站，可在「回收站」中恢复。恢复文件不会自动恢复画布中的元素和位置。",
					)}
				</span>
			)}
		</span>
	)
}
