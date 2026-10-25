import { ExternalLink, RefreshCw, X } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

const WEBSITE_LOAD_FALLBACK_DELAY = 8000
const WEBSITE_IFRAME_ALLOW =
	"clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; picture-in-picture; web-share"
const WEBSITE_IFRAME_SANDBOX =
	"allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation"

interface WebsiteIframeTabContentProps {
	title: string
	url: string
	description?: string
	isActive?: boolean
}

const WebsiteIframeTabContent = memo(function WebsiteIframeTabContent({
	title,
	url,
	description,
	isActive,
}: WebsiteIframeTabContentProps) {
	const { t } = useTranslation("super")
	const shouldLoadIframe = isActive !== false
	const [hasLoaded, setHasLoaded] = useState(false)
	const [showLoadFallback, setShowLoadFallback] = useState(false)
	const [isLoadFallbackDismissed, setIsLoadFallbackDismissed] = useState(false)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		setHasLoaded(false)
		setShowLoadFallback(false)
		setIsLoadFallbackDismissed(false)

		if (!shouldLoadIframe || !url) return undefined

		const timer = window.setTimeout(() => {
			setShowLoadFallback(true)
		}, WEBSITE_LOAD_FALLBACK_DELAY)

		return () => window.clearTimeout(timer)
	}, [refreshKey, shouldLoadIframe, url])

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-3">
				<div className="min-w-0">
					<div className="truncate text-sm font-medium leading-5 text-foreground">
						{title}
					</div>
					{description ? (
						<div className="truncate text-xs leading-4 text-muted-foreground">
							{description}
						</div>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						aria-label={t("fileViewer.website.refresh")}
						title={t("fileViewer.website.refresh")}
						className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onClick={() => setRefreshKey((current) => current + 1)}
						data-testid="set-refresh-key"
					>
						<RefreshCw size={14} />
					</button>
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						className={cn(
							"inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
						)}
						data-testid="website-iframe-tab-content-link"
					>
						<ExternalLink size={14} />
						{t("fileViewer.website.openExternal")}
					</a>
				</div>
			</div>
			<div className="relative min-h-0 flex-1 bg-white">
				<iframe
					key={`${url}:${refreshKey}`}
					title={title}
					src={url}
					allow={WEBSITE_IFRAME_ALLOW}
					allowFullScreen
					referrerPolicy="no-referrer"
					sandbox={WEBSITE_IFRAME_SANDBOX}
					loading={shouldLoadIframe ? "eager" : "lazy"}
					onLoad={() => {
						setHasLoaded(true)
						setShowLoadFallback(false)
					}}
					className="absolute inset-0 h-full w-full border-0 bg-white"
					data-testid="set-has-loaded"
				/>
				{showLoadFallback && !hasLoaded && !isLoadFallbackDismissed ? (
					<div
						data-testid="website-load-fallback"
						className="absolute bottom-4 right-4 z-10 max-w-[360px] rounded-lg border border-border/70 bg-background/95 p-4 pr-10 text-left shadow-lg"
					>
						<button
							type="button"
							aria-label={t("fileViewer.website.closeLoadFallback")}
							title={t("fileViewer.website.closeLoadFallback")}
							className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							onClick={() => setIsLoadFallbackDismissed(true)}
							data-testid="set-is-load-fallback-dismissed"
						>
							<X size={13} aria-hidden="true" />
						</button>
						<div>
							<div className="text-sm font-medium text-foreground">
								{t("fileViewer.website.loadFallbackTitle")}
							</div>
							<div className="mt-2 text-xs leading-5 text-muted-foreground">
								{t("fileViewer.website.loadFallbackDescription")}
							</div>
							<a
								href={url}
								target="_blank"
								rel="noreferrer"
								className="mt-4 inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
								data-testid="website-iframe-tab-content-link-2"
							>
								<ExternalLink size={14} />
								{t("fileViewer.website.openExternal")}
							</a>
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
})

export default WebsiteIframeTabContent
