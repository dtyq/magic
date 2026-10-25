import { AlertTriangle, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import CopyFeedbackButton from "./CopyFeedbackButton"
import { useDesignStyleSource } from "./useDesignStyleSource"

interface DesignStyleRawPreviewProps {
	style: DesignStyle
	active: boolean
}

export default function DesignStyleRawPreview({ style, active }: DesignStyleRawPreviewProps) {
	const { t } = useTranslation("super")
	const { status, source, retry } = useDesignStyleSource(style.code, active)

	return (
		<section className="space-y-3" data-testid="design-style-raw-preview" data-status={status}>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h4 className="truncate text-sm font-semibold text-foreground">
						{t("htmlEditor.designStyle.rawSource")}
					</h4>
					<p className="truncate text-[11px] text-muted-foreground">
						{t("htmlEditor.designStyle.rawSourceDescription", { code: style.code })}
					</p>
				</div>
				{status === "success" && source?.content && (
					<CopyFeedbackButton
						value={source.content}
						label={t("htmlEditor.designStyle.copyRawSource")}
					>
						{t("htmlEditor.designStyle.copyRawSource")}
					</CopyFeedbackButton>
				)}
			</div>

			{status === "loading" && (
				<div
					className="rounded-xl border border-border/70 bg-background px-4 py-8 text-center text-xs text-muted-foreground"
					data-testid="design-style-raw-loading"
				>
					{t("htmlEditor.designStyle.rawSourceLoading")}
				</div>
			)}

			{status === "error" && (
				<div
					className="rounded-xl border border-destructive/40 bg-destructive/[0.04] px-4 py-6"
					data-testid="design-style-raw-error"
				>
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
						<div className="min-w-0 flex-1">
							<div className="text-xs font-medium text-foreground">
								{t("htmlEditor.designStyle.rawSourceError")}
							</div>
							<button
								type="button"
								className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted"
								onClick={retry}
								data-testid="design-style-raw-retry"
							>
								<RotateCcw className="size-4" />
								{t("htmlEditor.designStyle.rawSourceRetry")}
							</button>
						</div>
					</div>
				</div>
			)}

			{status === "success" && (
				<>
					{source?.content ? (
						<pre
							className=" whitespace-pre-wrap break-words rounded-md bg-muted/30 p-4 font-mono text-xs leading-6 text-foreground"
							data-testid="design-style-raw-content"
						>
							{source.content}
						</pre>
					) : (
						<div
							className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground"
							data-testid="design-style-raw-empty"
						>
							{t("htmlEditor.designStyle.rawSourceEmpty")}
						</div>
					)}
					{source?.sha256 && (
						<div className="truncate font-mono text-[9px] text-muted-foreground/80">
							sha256: {source.sha256}
						</div>
					)}
				</>
			)}
		</section>
	)
}
