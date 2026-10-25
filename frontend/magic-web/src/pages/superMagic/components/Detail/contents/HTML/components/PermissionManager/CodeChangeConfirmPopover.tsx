import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type {
	HtmlPermissionCodeChangeConfirmRequest,
	HtmlPermissionCodeChangeDecision,
} from "../../iframe-api/services/IframePermissionService"
import { useHtmlPermissionI18n } from "../../hooks/useHtmlPermissionI18n"

/** Toolbar buttons that open the permission manager carry this attribute so the bubble can point at them. */
export const HTML_PERMISSION_ANCHOR_ATTRIBUTE = "data-html-permission-anchor"

const VIEWPORT_MARGIN = 12
const BUBBLE_WIDTH = 320

interface CodeChangeConfirmBubbleProps {
	appName: string
	scopes: HtmlPermissionCodeChangeConfirmRequest["scopes"]
	onDecision: (decision: HtmlPermissionCodeChangeDecision) => void
}

function findVisibleAnchor(): HTMLElement | null {
	const candidates = document.querySelectorAll<HTMLElement>(
		`[${HTML_PERMISSION_ANCHOR_ATTRIBUTE}]`,
	)
	for (const element of candidates) {
		const rect = element.getBoundingClientRect()
		if (rect.width > 0 && rect.height > 0) return element
	}
	return null
}

/**
 * Tooltip-styled reminder with actions. It is rendered next to the permission button when one is
 * on screen, otherwise at the top center, so the user sees which app is asking without a modal
 * covering the page they are editing. The caller owns the pending request; the bubble only reports
 * the user's decision.
 */
function CodeChangeConfirmBubble({ appName, scopes, onDecision }: CodeChangeConfirmBubbleProps) {
	const { t } = useTranslation("super")
	const { getScopeLabel } = useHtmlPermissionI18n()
	const bubbleRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState<{
		top: number
		left: number
		width: number
		arrowLeft: number | null
	}>({
		top: 64,
		left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - BUBBLE_WIDTH) / 2),
		width: Math.min(BUBBLE_WIDTH, Math.max(0, window.innerWidth - VIEWPORT_MARGIN * 2)),
		arrowLeft: null,
	})

	// Anchored placement: right-align under the button, clamped to the viewport. The arrow keeps
	// pointing at the button's center even when the bubble had to shift.
	useLayoutEffect(() => {
		const place = () => {
			const width = Math.min(
				BUBBLE_WIDTH,
				Math.max(0, window.innerWidth - VIEWPORT_MARGIN * 2),
			)
			const anchor = findVisibleAnchor()
			if (!anchor) {
				setPosition({
					top: 64,
					left: (window.innerWidth - width) / 2,
					width,
					arrowLeft: null,
				})
				return
			}
			const rect = anchor.getBoundingClientRect()
			const left = Math.min(
				Math.max(VIEWPORT_MARGIN, rect.right - width),
				window.innerWidth - width - VIEWPORT_MARGIN,
			)
			setPosition({
				top: rect.bottom + 10,
				left,
				width,
				arrowLeft: Math.min(Math.max(16, rect.left + rect.width / 2 - left), width - 16),
			})
		}
		place()
		window.addEventListener("resize", place)
		return () => window.removeEventListener("resize", place)
	}, [])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onDecision("deny")
		}
		window.addEventListener("keydown", handleKeyDown)
		bubbleRef.current?.querySelector<HTMLButtonElement>("button[data-primary]")?.focus()
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onDecision])

	const scopeLabel = scopes
		.map(getScopeLabel)
		.join(t("htmlEditor.permissionAuthorizationConfirm.scopeSeparator"))

	return (
		// Above MagicModal-based dialogs (they raise their own layer), like the TTL menu elsewhere in this feature.
		<div
			ref={bubbleRef}
			role="alertdialog"
			aria-label={t("htmlEditor.codeChangeConfirm.title")}
			className="fixed z-[calc(var(--z-index-modal)+100)] rounded-md bg-foreground px-3 py-2.5 text-xs text-background shadow-md"
			style={{ top: position.top, left: position.left, width: position.width }}
			data-testid="html-permission-code-change-confirm"
		>
			{position.arrowLeft !== null ? (
				<span
					aria-hidden
					className="absolute -top-1 size-2 rotate-45 bg-foreground"
					style={{ left: position.arrowLeft - 4 }}
				/>
			) : null}
			<p className="flex items-center gap-1.5 text-sm font-medium">
				<TriangleAlert size={14} className="shrink-0" />
				{t("htmlEditor.codeChangeConfirm.title")}
			</p>
			<p className="mt-1.5 break-words text-background/80">
				{t("htmlEditor.codeChangeConfirm.content", {
					appName: appName || t("htmlEditor.permissionManager.defaultAppName"),
					scope: scopeLabel,
				})}
			</p>
			<div className="mt-2.5 flex justify-end gap-1.5">
				<Button
					size="sm"
					variant="outline"
					className="h-7 border-background/30 bg-transparent px-2 text-xs text-background hover:bg-background/10 hover:text-background"
					onClick={() => onDecision("deny")}
				>
					{t("htmlEditor.codeChangeConfirm.deny")}
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="h-7 border-background/30 bg-transparent px-2 text-xs text-background hover:bg-background/10 hover:text-background"
					onClick={() => onDecision("once")}
				>
					{t("htmlEditor.codeChangeConfirm.once")}
				</Button>
				<Button
					size="sm"
					data-primary
					className="h-7 bg-background px-2 text-xs text-foreground hover:bg-background/90"
					onClick={() => onDecision("remember")}
				>
					{t("htmlEditor.codeChangeConfirm.remember")}
				</Button>
			</div>
		</div>
	)
}

/**
 * Shows the reminder and resolves with the user's decision. An aborted request (the app was
 * closed or the queue disposed) closes the bubble and denies, so nothing stays on screen for a
 * request nobody is waiting for.
 */
export function requestHtmlPermissionCodeChangeConfirm({
	appName,
	scopes,
	signal,
}: HtmlPermissionCodeChangeConfirmRequest): Promise<HtmlPermissionCodeChangeDecision> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve("deny")
			return
		}
		const previousFocus = document.activeElement
		const container = document.createElement("div")
		document.body.appendChild(container)
		const root = createRoot(container)
		let settled = false

		const finish = (decision: HtmlPermissionCodeChangeDecision) => {
			if (settled) return
			settled = true
			signal?.removeEventListener("abort", handleAbort)
			resolve(decision)
			// Unmount after the current event so the clicked button is not removed mid-handler.
			window.setTimeout(() => {
				const shouldRestoreFocus = container.contains(document.activeElement)
				root.unmount()
				container.remove()
				// Return to the caller unless the user already moved focus elsewhere during cancellation.
				if (
					shouldRestoreFocus &&
					previousFocus instanceof HTMLElement &&
					previousFocus.isConnected
				) {
					previousFocus.focus({ preventScroll: true })
				}
			}, 0)
		}
		const handleAbort = () => finish("deny")
		signal?.addEventListener("abort", handleAbort, { once: true })

		root.render(
			<CodeChangeConfirmBubble appName={appName} scopes={scopes} onDecision={finish} />,
		)
	})
}
