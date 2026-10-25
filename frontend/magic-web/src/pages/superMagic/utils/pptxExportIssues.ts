import type { ExportIssue } from "@magic/html2pptx"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { reportPptxExportIssue } from "./pptxLogger"

export type PptxExportIssueStatus = "completed-with-issues" | "failed"

export interface PptxRepairPromptCopy {
	/** Localized instruction shown before the issue list. */
	instruction: string
	/** Localized formatter for one issue line. */
	formatIssue: (issue: ExportIssue) => string
}

export function createPptxRepairPrompt(issues: ExportIssue[], copy: PptxRepairPromptCopy): string {
	const details = issues.map(copy.formatIssue).join("\n")
	return `${copy.instruction}\n${details}`
}

/** Convert an export rejection into the same safe issue shape used by page diagnostics. */
export function createPptxExportFailureIssue(error: unknown): ExportIssue {
	const diagnostic =
		error && typeof error === "object" && "diagnostic" in error
			? (error as { diagnostic?: Record<string, unknown> }).diagnostic
			: undefined
	const pageIndex = typeof diagnostic?.pageIndex === "number" ? diagnostic.pageIndex : undefined
	const details = diagnostic
		? {
				phase: diagnostic.phase,
				failureCode: diagnostic.code,
				...(diagnostic.details ? { diagnostic: diagnostic.details } : {}),
				...(error instanceof Error && error.stack
					? { stack: error.stack.slice(0, 4000) }
					: {}),
			}
		: undefined
	return {
		pageIndex,
		code: "render-error",
		message: error instanceof Error ? error.message : String(error),
		severity: "error",
		details,
	}
}

export function publishPptxExportFailure(
	issues: ExportIssue[],
	error: unknown,
	context: { fileId?: string; fileName?: string } = {},
) {
	const failure = createPptxExportFailureIssue(error)
	const hasSameFailure = issues.some(
		(issue) =>
			issue.code === failure.code &&
			issue.pageIndex === failure.pageIndex &&
			issue.message === failure.message,
	)
	const hasFatalIssue = issues.some((issue) => issue.severity === "error")
	publishPptxExportIssues(
		hasSameFailure || hasFatalIssue ? issues : [...issues, failure],
		context,
		"failed",
	)
}

export function publishPptxExportIssues(
	issues: ExportIssue[],
	context: { fileId?: string; fileName?: string } = {},
	status: PptxExportIssueStatus = "completed-with-issues",
) {
	if (issues.length === 0) return
	const uniqueIssues = issues.filter(
		(issue, index, all) =>
			all.findIndex(
				(candidate) =>
					candidate.code === issue.code &&
					candidate.pageIndex === issue.pageIndex &&
					candidate.message === issue.message,
			) === index,
	)
	for (const issue of uniqueIssues) {
		reportPptxExportIssue(issue, {
			status,
			fileId: context.fileId,
			fileName: context.fileName,
		})
	}
	pubsub.publish(PubSubEvents.Pptx_Export_Issues, {
		issues: uniqueIssues,
		status,
		fileId: context.fileId,
		fileName: context.fileName,
	})
}
