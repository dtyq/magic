import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export interface AssetAgreementModalProps {
	visible: boolean
	onClose: () => void
	onConfirm?: () => void | Promise<void>
}

export function AssetAgreementModal({ visible, onClose, onConfirm }: AssetAgreementModalProps) {
	const { t } = useTranslation("super")
	const [accepted, setAccepted] = useState(false)
	const [confirming, setConfirming] = useState(false)

	useEffect(() => {
		if (!visible) return
		setAccepted(false)
		setConfirming(false)
	}, [visible])

	const handleConfirm = async () => {
		if (!accepted || confirming) return

		setConfirming(true)
		try {
			await onConfirm?.()
			onClose()
		} finally {
			setConfirming(false)
		}
	}

	const clauses = [
		{
			title: t("assetAgreement.clause1Title"),
			detail: t("assetAgreement.clause1Detail"),
		},
		{
			title: t("assetAgreement.clause2Title"),
			detail: t("assetAgreement.clause2Detail"),
		},
		{
			title: t("assetAgreement.clause3Title"),
			detail: t("assetAgreement.clause3Detail"),
		},
	]

	return (
		<Dialog
			open={visible}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !confirming) onClose()
			}}
		>
			<DialogContent
				className="w-[min(520px,calc(100vw-32px))] max-w-[520px] gap-0 p-0 sm:max-w-[520px]"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onPointerDownOutside={(event) => event.preventDefault()}
				onInteractOutside={(event) => event.preventDefault()}
				data-testid="asset-agreement-modal"
			>
				<DialogHeader className="border-b px-5 py-4 pr-12 text-left">
					<DialogTitle>{t("assetAgreement.title")}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 px-5 py-5" data-testid="asset-agreement-content">
					<p className="text-sm text-muted-foreground">{t("assetAgreement.intro")}</p>
					<ol className="space-y-4">
						{clauses.map((clause, index) => (
							<li key={clause.title} className="space-y-1">
								<p className="text-sm font-medium text-foreground">
									{index + 1}. {clause.title}
								</p>
								<p className="pl-4 text-sm text-muted-foreground">
									{clause.detail}
								</p>
							</li>
						))}
					</ol>
					<label className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-3 text-sm text-foreground">
						<Checkbox
							checked={accepted}
							disabled={confirming}
							onCheckedChange={(checked) => setAccepted(checked === true)}
							aria-label={t("assetAgreement.accept")}
							className="mt-0.5"
						/>
						<span>{t("assetAgreement.accept")}</span>
					</label>
				</div>

				<DialogFooter className="border-t px-5 py-3 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={confirming}
						data-testid="asset-agreement-cancel"
					>
						{t("assetAgreement.disagree")}
					</Button>
					<Button
						type="button"
						onClick={() => void handleConfirm()}
						disabled={!accepted || confirming}
						data-testid="asset-agreement-confirm"
					>
						{confirming ? (
							<Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
						) : null}
						{t("assetAgreement.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
