import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { LayoutConstraintHint } from "../utils/layoutConstraintHint"

interface LayoutConstraintHintCardProps {
	hint: LayoutConstraintHint
	selector?: string
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	onApply?: (styles: Record<string, string>) => void
}

interface PreviewBatch {
	gen: number
}

export function LayoutConstraintHintCard({
	hint,
	selector,
	editorRef,
	onApply,
}: LayoutConstraintHintCardProps) {
	const { t } = useTranslation("super")
	const previewGenRef = useRef(0)
	const previewSessionRef = useRef(false)
	const previewPromiseRef = useRef<Promise<void> | null>(null)
	const previewBatchRef = useRef<PreviewBatch | null>(null)
	const message =
		hint.kind === "distributed-alignment"
			? t("stylePanel.layoutHintDistributed")
			: hint.axis === "width"
				? t("stylePanel.layoutHintParentWidth")
				: t("stylePanel.layoutHintParentHeight")
	const action =
		hint.kind === "distributed-alignment"
			? t("stylePanel.layoutHintFixGap")
			: hint.axis === "width"
				? t("stylePanel.layoutHintFixWidth")
				: t("stylePanel.layoutHintFixHeight")

	function invalidatePreview() {
		previewGenRef.current += 1
		previewSessionRef.current = false
	}

	const cancelPreviewBatch = useCallback(
		async (batch: PreviewBatch | null = previewBatchRef.current) => {
			previewBatchRef.current = null
			previewSessionRef.current = false
			const editor = editorRef?.current
			if (!batch || !editor) return
			try {
				await editor.cancelBatchOperation()
			} catch (error) {
				console.error("[LayoutConstraintHint] Failed to cancel preview batch:", error)
			}
		},
		[editorRef],
	)

	// Invalidate in-flight previews and cancel any active batch when the
	// component unmounts (e.g. the panel closes or the selection changes).
	useEffect(() => {
		return () => {
			previewGenRef.current += 1
			previewSessionRef.current = false
			previewPromiseRef.current = null
			void cancelPreviewBatch()
		}
	}, [cancelPreviewBatch])

	async function waitForPreview() {
		const pending = previewPromiseRef.current
		if (!pending) return
		await pending.catch(() => {})
	}

	async function runPreview(gen: number) {
		if (!selector || !editorRef?.current) return
		let ownsBatch = false
		try {
			if (gen !== previewGenRef.current) return
			await editorRef.current.beginBatchOperation(selector, hint.fix)
			previewBatchRef.current = { gen }
			ownsBatch = true
			if (gen !== previewGenRef.current) {
				await cancelPreviewBatch()
				return
			}
			await editorRef.current.applyStylesTemporary(selector, hint.fix)
			if (gen !== previewGenRef.current) {
				await cancelPreviewBatch()
				return
			}
			previewSessionRef.current = true
		} catch (error) {
			console.error("[LayoutConstraintHint] Preview failed:", error)
			if (ownsBatch) {
				await cancelPreviewBatch()
			}
		}
	}

	function preview() {
		if (!selector || !editorRef?.current) return
		const gen = previewGenRef.current
		const promise = runPreview(gen)
		previewPromiseRef.current = promise
		void promise.finally(() => {
			if (previewPromiseRef.current === promise) {
				previewPromiseRef.current = null
			}
		})
	}

	async function restore() {
		invalidatePreview()
		await waitForPreview()
		if (!selector || !editorRef?.current) return
		try {
			await cancelPreviewBatch()
			await editorRef.current.refreshSelectedElement(selector)
		} catch (error) {
			console.error("[LayoutConstraintHint] Restore failed:", error)
		}
	}

	async function apply() {
		await waitForPreview()
		if (selector && editorRef?.current && previewSessionRef.current) {
			invalidatePreview()
			try {
				await editorRef.current.endBatchOperation(selector, hint.fix)
				await editorRef.current.refreshSelectedElement(selector)
			} catch (error) {
				console.error("[LayoutConstraintHint] Apply failed:", error)
			}
			return
		}
		invalidatePreview()
		onApply?.(hint.fix)
	}

	return (
		<div
			data-testid={`layout-constraint-hint-${hint.kind}`}
			className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground"
		>
			<p>{message}</p>
			<button
				type="button"
				data-testid={`layout-constraint-hint-apply-${hint.kind}`}
				className="mt-1 text-[10px] font-medium text-foreground underline-offset-2 hover:underline"
				onMouseEnter={() => void preview()}
				onMouseLeave={() => void restore()}
				onClick={() => void apply()}
			>
				{action}
			</button>
		</div>
	)
}
