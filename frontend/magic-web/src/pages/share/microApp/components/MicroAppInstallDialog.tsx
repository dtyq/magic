import { useTranslation } from "react-i18next"
import { Check, CheckCheck, Copy, ExternalLink, Share2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"

import type { MicroAppInstallDialogMode } from "../hooks/microAppInstall"

interface MicroAppInstallDialogProps {
	mode: MicroAppInstallDialogMode
	open: boolean
	canRememberPassword: boolean
	rememberPassword: boolean
	linkCopied: boolean
	onOpenChange: (open: boolean) => void
	onRememberPasswordChange: (checked: boolean) => void
	onConfirm: () => void
	onCopyLink: () => void
	onOpenBrowser: () => void
}

export default function MicroAppInstallDialog({
	mode,
	open,
	canRememberPassword,
	rememberPassword,
	linkCopied,
	onOpenChange,
	onRememberPasswordChange,
	onConfirm,
	onCopyLink,
	onOpenBrowser,
}: MicroAppInstallDialogProps) {
	const { t } = useTranslation("super")
	const title =
		mode === "ios"
			? t("microAppShare.installIosTitle")
			: mode === "webview"
				? t("microAppShare.installWebViewTitle")
				: t("microAppShare.installTitle")
	const description =
		mode === "ios"
			? t("microAppShare.installIosDescription")
			: mode === "webview"
				? t("microAppShare.installWebViewDescription")
				: t("microAppShare.installDescription")

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[420px] gap-5" data-testid="micro-app-install-dialog">
				<DialogHeader className="pr-6">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				{mode === "ios" ? (
					<div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground">
						<div className="flex items-start gap-3">
							<Share2 className="mt-0.5 size-4 shrink-0 text-primary" />
							<div className="space-y-1">
								<p className="font-medium">
									{t("microAppShare.installIosStepShare")}
								</p>
								<p className="text-muted-foreground">
									{t("microAppShare.installIosStepHome")}
								</p>
							</div>
						</div>
					</div>
				) : null}

				{canRememberPassword ? (
					<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
						<Checkbox
							checked={rememberPassword}
							onCheckedChange={(checked) =>
								onRememberPasswordChange(checked === true)
							}
							aria-label={t("microAppShare.rememberPassword")}
							data-testid="micro-app-install-remember-password"
						/>
						<span>
							<span className="block font-medium text-foreground">
								{t("microAppShare.rememberPassword")}
							</span>
							<span className="mt-0.5 block text-xs text-muted-foreground">
								{t("microAppShare.rememberPasswordHint")}
							</span>
						</span>
					</label>
				) : null}

				<DialogFooter>
					{mode === "webview" ? (
						<>
							<Button type="button" variant="outline" size="lg" onClick={onCopyLink}>
								{linkCopied ? (
									<CheckCheck className="size-4" />
								) : (
									<Copy className="size-4" />
								)}
								{linkCopied
									? t("microAppShare.linkCopied")
									: t("microAppShare.copyLink")}
							</Button>
							<Button type="button" size="lg" onClick={onOpenBrowser}>
								<ExternalLink className="size-4" />
								{t("microAppShare.openInBrowser")}
							</Button>
						</>
					) : (
						<Button
							type="button"
							size="lg"
							onClick={onConfirm}
							data-testid="micro-app-install-confirm"
						>
							<Check className="size-4" />
							{mode === "ios" ? t("common.done") : t("microAppShare.installConfirm")}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
