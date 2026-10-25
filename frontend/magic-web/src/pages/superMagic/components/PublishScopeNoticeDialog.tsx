import { useRef } from "react"
import { Info } from "lucide-react"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { useTranslation } from "react-i18next"

interface PublishScopeNoticeDialogProps {
	open: boolean
	publishPath: string
	outsidePaths: string[]
	onContinue: () => void | Promise<void>
	onCancel: () => void
}

const MAX_VISIBLE_OUTSIDE_PATHS = 10

export default function PublishScopeNoticeDialog({
	open,
	publishPath,
	outsidePaths,
	onContinue,
	onCancel,
}: PublishScopeNoticeDialogProps) {
	const { t } = useTranslation("crew/market")
	const isContinuingRef = useRef(false)

	const handleContinue = () => {
		isContinuingRef.current = true
		void onContinue()
	}

	const visibleOutsidePaths = outsidePaths.slice(0, MAX_VISIBLE_OUTSIDE_PATHS)
	const hiddenOutsidePathCount = outsidePaths.length - visibleOutsidePaths.length

	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					if (isContinuingRef.current) {
						isContinuingRef.current = false
						return
					}
					onCancel()
				}
			}}
		>
			{/* Keep the dialog inset on narrow screens while bounding its desktop width. */}
			<AlertDialogContent
				size="sm"
				className="w-[calc(100vw-32px)] !max-w-[560px] gap-0 p-0"
				data-testid="publish-scope-notice-dialog"
			>
				<AlertDialogHeader className="place-items-start gap-3 p-6 pb-5 text-left sm:text-left">
					<div className="flex w-full items-start gap-3">
						<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Info className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1 space-y-1">
							<AlertDialogTitle className="text-base font-semibold leading-6">
								{t("publishScopeNotice.title")}
							</AlertDialogTitle>
							<AlertDialogDescription className="min-w-0 max-w-none overflow-hidden text-left text-sm leading-6 text-muted-foreground">
								<span className="block">{t("publishScopeNotice.intro")}</span>
								<span className="mt-3 block min-w-0 max-w-full overflow-hidden rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
									<span className="block text-xs font-medium text-muted-foreground">
										{t("publishScopeNotice.scopeLabel")}
									</span>
									<code className="mt-1 block break-all font-mono text-sm font-medium leading-5 text-foreground">
										{publishPath}
									</code>
								</span>
								<span className="mt-3 block min-w-0 max-w-full overflow-hidden rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
									<span className="flex items-center justify-between gap-3">
										<span className="min-w-0 truncate text-xs font-medium text-amber-700 dark:text-amber-300">
											{t("publishScopeNotice.outsidePathsLabel")}
										</span>
										<span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-700 dark:text-amber-300">
											{outsidePaths.length}
										</span>
									</span>
									{/* Bound the list so many files scroll inside the card and long paths cannot widen it. */}
									<span
										className="mt-2 block max-h-56 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border border-amber-500/10 bg-background/70 p-1"
										role="list"
									>
										{visibleOutsidePaths.map((path) => (
											<span
												key={path}
												className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded px-2 py-1 text-xs leading-5 hover:bg-muted/50"
												role="listitem"
												title={path}
											>
												<span
													className="size-1.5 shrink-0 rounded-full bg-amber-500"
													aria-hidden="true"
												/>
												<code className="block w-0 min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-foreground/80">
													{path}
												</code>
											</span>
										))}
									</span>
									{hiddenOutsidePathCount > 0 && (
										<span className="mt-1 block px-2 text-xs leading-5 text-muted-foreground">
											{t("publishScopeNotice.morePaths", {
												count: hiddenOutsidePathCount,
											})}
										</span>
									)}
								</span>
								<span className="mt-3 block">
									{t("publishScopeNotice.confirm")}
								</span>
							</AlertDialogDescription>
						</div>
					</div>
				</AlertDialogHeader>
				<AlertDialogFooter className="mx-0 mb-0 rounded-b-xl border-t bg-muted/30 p-4">
					<AlertDialogCancel className="h-10 w-full rounded-lg text-sm font-medium">
						{t("publishScopeNotice.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						className="h-10 w-full rounded-lg text-sm font-medium shadow-sm"
						onClick={handleContinue}
					>
						{t("publishScopeNotice.continue")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
