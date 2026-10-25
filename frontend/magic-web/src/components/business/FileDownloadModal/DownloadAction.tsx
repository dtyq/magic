import { Button } from "@/components/shadcn-ui/button"

interface DownloadActionProps {
	nativeDownload: boolean
	downloadUrl: string
	fileName: string
	downloadTarget?: string
	onDownload?: () => void
	label: string
	className: string
	size: "lg"
	variant?: "default" | "outline"
	"data-testid"?: string
}

/**
 * Uses a real anchor for the manual fallback. This is important for browsers
 * that have blocked automatic downloads for the current tab. The caller can
 * choose the target explicitly, so the same action works for either a current
 * page navigation or a new-tab fallback.
 */
export default function DownloadAction({
	nativeDownload,
	downloadUrl,
	fileName,
	downloadTarget,
	onDownload,
	label,
	className,
	size,
	variant = "default",
	"data-testid": dataTestId,
}: DownloadActionProps) {
	if (nativeDownload) {
		const isBlobOrDataUrl = /^(blob:|data:)/i.test(downloadUrl)

		return (
			<Button
				asChild
				className={className}
				size={size}
				variant={variant}
				data-testid={dataTestId}
			>
				<a
					href={downloadUrl}
					target={downloadTarget || "_blank"}
					rel="noopener noreferrer"
					download={isBlobOrDataUrl ? fileName || undefined : undefined}
				>
					{label}
				</a>
			</Button>
		)
	}

	return (
		<Button
			className={className}
			size={size}
			variant={variant}
			onClick={onDownload}
			data-testid={dataTestId}
		>
			{label}
		</Button>
	)
}
