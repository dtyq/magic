import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import type { PPTNotesSlide } from "./pptNotesTypes"

export default function PPTNotesSlideLoading({
	slide,
	isCurrentPage,
	onLoad,
	enabled,
}: {
	slide: PPTNotesSlide
	isCurrentPage: boolean
	onLoad?: (key: string) => Promise<boolean>
	enabled: boolean
}) {
	const { t } = useTranslation("super")
	const [failed, setFailed] = useState(false)
	const [loading, setLoading] = useState(false)
	const load = useMemoizedFn(async () => {
		setLoading(true)
		setFailed(false)
		try {
			setFailed(!(await onLoad?.(slide.key)))
		} catch {
			setFailed(true)
		} finally {
			setLoading(false)
		}
	})
	useEffect(() => {
		// The store's shared priority queue limits concurrency and deduplicates preview requests.
		if (enabled) void load()
	}, [enabled, slide.key, load])
	const hasError = !loading && (failed || slide.loadingError)
	return (
		<div className="flex h-full flex-col gap-3 p-4 text-xs text-muted-foreground">
			<h2>
				{isCurrentPage
					? t("ppt.speakerNotes.currentPageTitle")
					: t("ppt.speakerNotes.pageTitle", { page: slide.slideIndex + 1 })}
			</h2>
			<div role="status" className="flex flex-1 items-center justify-center gap-2">
				{hasError ? (
					<>
						<span>{t("ppt.speakerNotes.loadFailed")}</span>
						<Button variant="outline" size="sm" onClick={() => void load()}>
							{t("ppt.speakerNotes.retry")}
						</Button>
					</>
				) : (
					<>
						<Loader2 className="size-4 animate-spin" />
						{t("ppt.speakerNotes.loading")}
					</>
				)}
			</div>
		</div>
	)
}
