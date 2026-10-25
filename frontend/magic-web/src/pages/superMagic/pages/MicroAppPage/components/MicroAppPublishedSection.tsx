import { Copy, Rocket } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"

interface MicroAppPublishedSectionProps {
	className?: string
	mobile: boolean
	publishedAtText: string
	accessUrl: string
	hasUnsavedPublishedChanges: boolean
	onCopyAccessUrl: () => void
	onCopyShareText: () => void
}

/** 展示已发布状态与复制入口，始终放在发布弹窗表单的最上方。 */
export default function MicroAppPublishedSection({
	className,
	mobile,
	publishedAtText,
	accessUrl,
	hasUnsavedPublishedChanges,
	onCopyAccessUrl,
	onCopyShareText,
}: MicroAppPublishedSectionProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className={cn(
				"rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20",
				className,
			)}
			data-testid="micro-app-published-section"
		>
			<div className="flex items-center gap-2">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
					<Rocket className="size-4" />
				</div>
				<div>
					<p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
						{t("microAppPage.publish.published")}
					</p>
					{publishedAtText ? (
						<p className="mt-0.5 text-xs text-emerald-700/75 dark:text-emerald-300/75">
							{t("microAppPage.publish.publishedAt", {
								time: publishedAtText,
							})}
						</p>
					) : null}
				</div>
			</div>
			{accessUrl ? (
				<div className="mt-2" data-testid="micro-app-publish-quick-share">
					<div className="relative">
						<Input
							readOnly
							value={accessUrl}
							className="h-9 min-w-0 bg-background pr-28 text-xs"
							data-testid="micro-app-publish-access-url"
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="absolute right-1 top-1 h-7 gap-1.5 px-2"
							onClick={onCopyAccessUrl}
							disabled={hasUnsavedPublishedChanges}
							aria-describedby={
								hasUnsavedPublishedChanges
									? "micro-app-publish-settings-changed"
									: undefined
							}
							data-testid="micro-app-publish-copy-link"
						>
							<Copy className="size-3.5" />
							{t("microAppPage.publish.copyLink")}
						</Button>
					</div>
					<div
						className={cn(
							"mt-2 flex items-center justify-between gap-2",
							mobile && "flex-col items-start",
						)}
					>
						<p className="text-xs text-muted-foreground">
							{t("microAppPage.publish.quickShareDescription")}
						</p>
						<Button
							type="button"
							size="sm"
							variant="default"
							className="h-8 shrink-0 gap-1.5"
							onClick={onCopyShareText}
							disabled={hasUnsavedPublishedChanges}
							data-testid="micro-app-publish-copy-share-text"
						>
							<Copy className="size-3.5" />
							{t("microAppPage.publish.copyShareText")}
						</Button>
					</div>
					{hasUnsavedPublishedChanges ? (
						<p
							id="micro-app-publish-settings-changed"
							className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
							role="status"
							data-testid="micro-app-publish-settings-changed"
						>
							{t("microAppPage.publish.settingsChanged")}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	)
}
