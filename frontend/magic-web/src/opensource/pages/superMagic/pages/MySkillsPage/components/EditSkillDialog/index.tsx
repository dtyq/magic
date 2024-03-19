import { memo, useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { Loader2 } from "lucide-react"
import IdentityStep from "@/opensource/pages/superMagic/components/ImportSkillDialog/components/IdentityStep"
import {
	createEmptySkillI18nText,
	createInitialSkillIdentityData,
	normalizeSkillI18nText,
} from "@/opensource/pages/superMagic/components/ImportSkillDialog/types"
import type { SkillIdentityData } from "@/opensource/pages/superMagic/components/ImportSkillDialog/types"
import { skillsService } from "@/opensource/services/skills/SkillsService"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import type { SkillDetailResponse } from "@/opensource/apis/modules/skills"

interface EditSkillDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Skill unique code; null means dialog is closed */
	skillCode: string | null
	/** Called after a skill is successfully saved */
	onSuccess?: () => void
}

const INITIAL_IDENTITY: SkillIdentityData = createInitialSkillIdentityData()

function mapDetailToIdentity(detail: SkillDetailResponse): SkillIdentityData {
	return {
		iconUrl: detail.logo || undefined,
		name: normalizeSkillI18nText(detail.name_i18n, detail.package_name),
		role: createEmptySkillI18nText(),
		description: normalizeSkillI18nText(detail.description_i18n, detail.package_description),
	}
}

function EditSkillDialog({ open, onOpenChange, skillCode, onSuccess }: EditSkillDialogProps) {
	const { t } = useTranslation("crew/market")

	const [identity, setIdentity] = useState<SkillIdentityData>(INITIAL_IDENTITY)
	const [isFetching, setIsFetching] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const { upload: uploadPublic } = useUpload({ storageType: "public" })

	// Fetch skill detail when dialog opens
	useEffect(() => {
		if (!open || !skillCode) return

		let cancelled = false
		setIsFetching(true)
		setIdentity(INITIAL_IDENTITY)

		skillsService
			.getSkillDetail(skillCode)
			.then((detail) => {
				if (cancelled) return
				setIdentity(mapDetailToIdentity(detail))
			})
			.catch(() => {
				if (cancelled) return
				magicToast.error(t("editSkill.errors.fetchFailed"))
				onOpenChange(false)
			})
			.finally(() => {
				if (!cancelled) setIsFetching(false)
			})

		return () => {
			cancelled = true
		}
	}, [open, skillCode, t, onOpenChange])

	const handleClose = useCallback(() => {
		onOpenChange(false)
		setTimeout(() => {
			setIdentity(INITIAL_IDENTITY)
			setIsSubmitting(false)
		}, 300)
	}, [onOpenChange])

	const handleConfirm = useCallback(async () => {
		if (!skillCode) return
		setIsSubmitting(true)
		try {
			let logo = identity.iconUrl

			if (identity.iconFile) {
				const { fullfilled } = await uploadPublic([
					{ name: identity.iconFile.name, file: identity.iconFile, status: "init" },
				])
				if (fullfilled.length > 0) logo = fullfilled[0].value.key
			}

			await skillsService.updateSkillInfo(skillCode, {
				name_i18n: identity.name,
				description_i18n: identity.description,
				logo,
			})

			magicToast.success(t("editSkill.done"))
			onSuccess?.()
			handleClose()
		} catch {
			magicToast.error(t("editSkill.errors.saveFailed"))
		} finally {
			setIsSubmitting(false)
		}
	}, [skillCode, identity, uploadPublic, t, onSuccess, handleClose])

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent
				className="w-[586px] !max-w-[586px] gap-0 p-0"
				data-testid="edit-skill-dialog"
			>
				<DialogHeader className="border-b border-border px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("editSkill.title")}
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex h-[452px] flex-col gap-2.5 overflow-y-auto p-4">
					{isFetching ? (
						<div
							className="flex h-full items-center justify-center"
							data-testid="edit-skill-loading"
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : (
						<IdentityStep identity={identity} onChange={setIdentity} />
					)}
				</ScrollArea>

				<DialogFooter className="border-t border-border px-3 py-3">
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							size="sm"
							onClick={handleClose}
							data-testid="edit-skill-cancel-button"
						>
							{t("editSkill.buttons.cancel")}
						</Button>
						<Button
							size="sm"
							disabled={isFetching || isSubmitting}
							onClick={handleConfirm}
							data-testid="edit-skill-confirm-button"
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

export default memo(EditSkillDialog)
