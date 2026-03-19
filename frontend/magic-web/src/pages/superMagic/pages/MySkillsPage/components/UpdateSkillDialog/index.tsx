import { memo, useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import IdentityStep from "@/pages/superMagic/components/ImportSkillDialog/components/IdentityStep"
import {
	createEmptySkillI18nText,
	createInitialSkillIdentityData,
	normalizeSkillI18nText,
} from "@/pages/superMagic/components/ImportSkillDialog/types"
import type { SkillIdentityData } from "@/pages/superMagic/components/ImportSkillDialog/types"
import { skillsService } from "@/services/skills/SkillsService"
import { useUpload } from "@/hooks/useUploadFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import type { ParseSkillResponse } from "@/apis/modules/skills"

interface UpdateSkillDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Pre-populated from file parse result; null when dialog is closed */
	parseResult: ParseSkillResponse | null
	onSuccess?: () => void
}

const INITIAL_IDENTITY: SkillIdentityData = createInitialSkillIdentityData()

function mapParseResultToIdentity(r: ParseSkillResponse): SkillIdentityData {
	return {
		iconUrl: r.logo || undefined,
		name: normalizeSkillI18nText(r.name_i18n, r.package_name),
		role: createEmptySkillI18nText(),
		description: normalizeSkillI18nText(r.description_i18n, r.package_description),
	}
}

function UpdateSkillDialog({ open, onOpenChange, parseResult, onSuccess }: UpdateSkillDialogProps) {
	const { t } = useTranslation("crew/market")

	const [identity, setIdentity] = useState<SkillIdentityData>(INITIAL_IDENTITY)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const { upload: uploadPublic } = useUpload({ storageType: "public" })

	// Sync identity from parseResult whenever dialog opens with new data
	useEffect(() => {
		if (open && parseResult) {
			setIdentity(mapParseResultToIdentity(parseResult))
			setIsSubmitting(false)
		}
	}, [open, parseResult])

	const handleClose = useCallback(() => {
		onOpenChange(false)
		setTimeout(() => {
			setIdentity(INITIAL_IDENTITY)
			setIsSubmitting(false)
		}, 300)
	}, [onOpenChange])

	const handleConfirm = useCallback(async () => {
		if (!parseResult) return
		setIsSubmitting(true)
		try {
			let logo = identity.iconUrl

			if (identity.iconFile) {
				const { fullfilled } = await uploadPublic([
					{ name: identity.iconFile.name, file: identity.iconFile, status: "init" },
				])
				if (fullfilled.length > 0) logo = fullfilled[0].value.key
			}

			await skillsService.importSkill({
				import_token: parseResult.import_token,
				name_i18n: identity.name,
				description_i18n: identity.description,
				logo,
			})

			magicToast.success(t("updateSkill.done"))
			onSuccess?.()
			handleClose()
		} catch {
			magicToast.error(t("updateSkill.errors.updateFailed"))
		} finally {
			setIsSubmitting(false)
		}
	}, [parseResult, identity, uploadPublic, t, onSuccess, handleClose])

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent
				className="w-[586px] !max-w-[586px] gap-0 p-0"
				data-testid="update-skill-dialog"
			>
				<DialogHeader className="border-b border-border px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("updateSkill.title")}
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex h-[452px] flex-col gap-2.5 overflow-y-auto p-4">
					<IdentityStep identity={identity} onChange={setIdentity} />
				</ScrollArea>

				<DialogFooter className="border-t border-border px-3 py-3">
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							size="sm"
							onClick={handleClose}
							data-testid="update-skill-cancel-button"
						>
							{t("editSkill.buttons.cancel")}
						</Button>
						<Button
							size="sm"
							disabled={isSubmitting}
							onClick={handleConfirm}
							data-testid="update-skill-confirm-button"
						>
							{isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
							{t("editSkill.buttons.confirm")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default memo(UpdateSkillDialog)
