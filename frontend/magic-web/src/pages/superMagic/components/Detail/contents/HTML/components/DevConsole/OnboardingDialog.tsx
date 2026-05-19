/**
 * OnboardingDialog
 *
 * First-time user guide for the DevConsole panel.
 * Shows once automatically, then can be reopened via help icon.
 * Content adapts to basic/advanced mode.
 */

import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Terminal, Globe, Zap, Send, Play, XCircle } from "lucide-react"
import type { DevConsoleMode } from "./types"

interface OnboardingDialogProps {
	open: boolean
	onClose: () => void
	mode: DevConsoleMode
}

/** Mini mock of a Console error row with the send button visible */
function ErrorRowPreview({ sendLabel }: { sendLabel: string }) {
	return (
		<div className="mt-1.5 flex items-center gap-1 rounded border border-border/60 bg-red-500/5 px-2 py-1 font-mono text-[10px]">
			<XCircle size={11} className="flex-shrink-0 text-red-500" />
			<span className="flex-1 truncate text-red-600/90">
				Uncaught TypeError: Cannot read properties of undefined
			</span>
			<span className="flex-shrink-0 text-muted-foreground">12:34:56</span>
			<button
				tabIndex={-1}
				className="ml-1 flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-red-500"
				title={sendLabel}
			>
				<Send size={11} />
			</button>
		</div>
	)
}

export function OnboardingDialog({ open, onClose, mode }: OnboardingDialogProps) {
	const { t } = useTranslation("super")
	const sendLabel = t("stylePanel.devConsole.sendToAgent")
	const isBasicMode = mode === "basic"

	const basicTips = [
		{
			icon: <XCircle size={16} className="text-red-500" />,
			title: t("stylePanel.devConsole.onboarding.basicErrorTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.basicErrorTipDesc"),
		},
		{
			icon: <Send size={16} className="text-green-500" />,
			title: t("stylePanel.devConsole.onboarding.sendTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.basicSendTipDesc"),
			preview: <ErrorRowPreview sendLabel={sendLabel} />,
		},
	]

	const advancedTips = [
		{
			icon: <Terminal size={16} className="text-yellow-500" />,
			title: t("stylePanel.devConsole.onboarding.consoleTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.consoleTipDesc"),
		},
		{
			icon: <Globe size={16} className="text-blue-500" />,
			title: t("stylePanel.devConsole.onboarding.networkTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.networkTipDesc"),
		},
		{
			icon: <Send size={16} className="text-green-500" />,
			title: t("stylePanel.devConsole.onboarding.sendTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.sendTipDesc"),
			preview: <ErrorRowPreview sendLabel={sendLabel} />,
		},
		{
			icon: <Play size={16} className="text-purple-500" />,
			title: t("stylePanel.devConsole.onboarding.evalTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.evalTipDesc"),
		},
		{
			icon: <Zap size={16} className="text-orange-500" />,
			title: t("stylePanel.devConsole.onboarding.insertTipTitle"),
			desc: t("stylePanel.devConsole.onboarding.insertTipDesc"),
		},
	]

	const tips = isBasicMode ? basicTips : advancedTips

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isBasicMode
							? t("stylePanel.devConsole.onboarding.basicTitle")
							: t("stylePanel.devConsole.onboarding.title")}
					</DialogTitle>
					<DialogDescription>
						{isBasicMode
							? t("stylePanel.devConsole.onboarding.basicDescription")
							: t("stylePanel.devConsole.onboarding.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{tips.map((tip, i) => (
						<div key={i} className="flex items-start gap-3">
							<div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
								{tip.icon}
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium">{tip.title}</p>
								<p className="text-xs text-muted-foreground">{tip.desc}</p>
								{"preview" in tip && tip.preview}
							</div>
						</div>
					))}
				</div>

				{isBasicMode && (
					<p className="text-xs text-muted-foreground">
						{t("stylePanel.devConsole.onboarding.basicSwitchHint")}
					</p>
				)}

				<DialogFooter>
					<Button onClick={onClose} size="sm">
						{t("stylePanel.devConsole.onboarding.gotIt")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
