import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import { resolveLayout, resolveScene } from "./DesignStyleLandingPage"

export type DesignStyleHtmlPreviewViewport = "desktop" | "tablet" | "mobile"

interface DesignStyleHtmlPreviewProps {
	style: DesignStyle
	viewport: DesignStyleHtmlPreviewViewport
}

type PreviewStatus = "loading" | "loaded" | "error"

const VIEWPORT_HEIGHTS: Record<DesignStyleHtmlPreviewViewport, string> = {
	desktop: "560px",
	tablet: "640px",
	mobile: "720px",
}

/**
 * Preview documents are generated at build time so each style keeps its own
 * visual artifact. Deriving the URL from BASE_URL also keeps deployments under
 * a non-root path working without granting the iframe access to the app.
 */
export function getDesignStylePreviewUrl(code: string): string {
	const baseUrl = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "")
	return `${baseUrl}/html-design-style/previews/${encodeURIComponent(code)}.html`
}

/**
 * Renders one generated landing page as a document, not as host React markup.
 * The empty sandbox is intentional: even if future generated content gains
 * scripts, forms, or navigation, this gallery must not grant execution,
 * same-origin access, or a bridge back into the application.
 */
export default function DesignStyleHtmlPreview({ style, viewport }: DesignStyleHtmlPreviewProps) {
	const { t } = useTranslation("super")
	const scene = resolveScene(style)
	const layout = resolveLayout(style)
	const previewUrl = useMemo(() => getDesignStylePreviewUrl(style.code), [style.code])
	const [reloadKey, setReloadKey] = useState(0)
	const [frameStatus, setFrameStatus] = useState<PreviewStatus>("loading")
	const previousUrlRef = useRef(previewUrl)

	useEffect(() => {
		// Reset the overlay only when selecting another static style document.
		if (previousUrlRef.current === previewUrl) return
		previousUrlRef.current = previewUrl
		setFrameStatus("loading")
	}, [previewUrl])

	const isError = frameStatus === "error"
	const handleRetry = () => {
		setFrameStatus("loading")
		setReloadKey((value) => value + 1)
	}

	return (
		<div
			className="relative mx-auto w-full overflow-hidden rounded-md bg-background"
			style={{ height: VIEWPORT_HEIGHTS[viewport] }}
			data-testid="design-style-html-preview"
			data-status={isError ? "error" : frameStatus}
		>
			{!isError && frameStatus === "loading" && (
				<div
					className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background text-xs text-muted-foreground"
					data-testid="design-style-html-loading"
					role="status"
				>
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					<span>{t("htmlEditor.designStyle.previewLoading")}</span>
				</div>
			)}
			{isError && (
				<div
					className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background px-6 text-center text-xs text-muted-foreground"
					data-testid="design-style-html-error"
					role="alert"
				>
					<AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
					<span>{t("htmlEditor.designStyle.previewLoadError")}</span>
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
						onClick={handleRetry}
						data-testid="design-style-html-retry"
					>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						{t("htmlEditor.designStyle.retry")}
					</button>
				</div>
			)}
			<iframe
				key={`${previewUrl}-${reloadKey}`}
				title={style.title}
				sandbox=""
				src={previewUrl}
				className="block h-full w-full border-0 bg-background"
				data-testid={`design-style-scene-${style.code}`}
				data-scene={scene}
				data-layout={layout}
				data-viewport={viewport}
				data-preview-url={previewUrl}
				onLoad={() => setFrameStatus("loaded")}
				onError={() => setFrameStatus("error")}
			/>
		</div>
	)
}
