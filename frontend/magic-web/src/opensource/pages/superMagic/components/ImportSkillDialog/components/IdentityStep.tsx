import { memo, useCallback, useRef, useState } from "react"
import { Globe, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/opensource/constants/locale"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Textarea } from "@/opensource/components/shadcn-ui/textarea"
import { Label } from "@/opensource/components/shadcn-ui/label"
import LocalizeDialog from "./LocalizeDialog"
import type { LocalizeField, SkillIdentityData } from "../types"

interface IdentityStepProps {
	identity: SkillIdentityData
	onChange: React.Dispatch<React.SetStateAction<SkillIdentityData>>
}

function IdentityStep({ identity, onChange }: IdentityStepProps) {
	const { t } = useTranslation("crew/market")
	const iconInputRef = useRef<HTMLInputElement>(null)

	const [localizeOpen, setLocalizeOpen] = useState(false)
	const [localizeField, setLocalizeField] = useState<LocalizeField>("name")

	const handleOpenLocalize = useCallback((field: LocalizeField) => {
		setLocalizeField(field)
		setLocalizeOpen(true)
	}, [])

	const handleLocalizeConfirm = useCallback(
		(updated: SkillIdentityData) => {
			onChange(updated)
			setLocalizeOpen(false)
		},
		[onChange],
	)

	const handleIconUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (!file) return
			const url = URL.createObjectURL(file)
			onChange((prev) => ({ ...prev, iconUrl: url, iconFile: file }))
			e.target.value = ""
		},
		[onChange],
	)

	return (
		<div className="flex w-full flex-col gap-4">
			<input
				ref={iconInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleIconUpload}
				data-testid="skill-icon-input"
			/>

			{/* Icon row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.icon")}
					</Label>
				</div>
				<div className="mr-12 flex flex-col items-center gap-2">
					<div
						className="flex size-[128px] items-center justify-center overflow-clip rounded-sm border border-border"
						data-testid="skill-icon-preview"
					>
						{identity.iconUrl ? (
							<img
								src={identity.iconUrl}
								alt="Skill icon"
								className="size-full object-cover"
							/>
						) : (
							<div className="flex size-full items-center justify-center bg-muted">
								<Upload className="size-8 text-muted-foreground" />
							</div>
						)}
					</div>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => iconInputRef.current?.click()}
						data-testid="skill-icon-upload-button"
					>
						<Upload className="size-4" />
						{t("importSkill.identity.upload")}
					</Button>
				</div>
			</div>

			{/* Skill Name row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.skillName")}
					</Label>
				</div>
				<div className="flex w-[320px] shrink-0 flex-col gap-2">
					<Input
						value={identity.name[SupportLocales.fallback]}
						onChange={(e) =>
							onChange((prev) => ({
								...prev,
								name: {
									...prev.name,
									[SupportLocales.fallback]: e.target.value,
								},
							}))
						}
						data-testid="skill-name-input"
					/>
				</div>
				<Button
					variant="outline"
					size="icon"
					className="size-9 shrink-0"
					onClick={() => handleOpenLocalize("name")}
					data-testid="skill-name-localize-button"
				>
					<Globe className="size-4" />
				</Button>
			</div>

			{/* Description row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.description")}
					</Label>
				</div>
				<div className="flex w-[320px] shrink-0 flex-col gap-2">
					<Textarea
						value={identity.description[SupportLocales.fallback]}
						onChange={(e) =>
							onChange((prev) => ({
								...prev,
								description: {
									...prev.description,
									[SupportLocales.fallback]: e.target.value,
								},
							}))
						}
						className="min-h-[126px] resize-none"
						data-testid="skill-description-textarea"
					/>
				</div>
				<Button
					variant="outline"
					size="icon"
					className="size-9 shrink-0"
					onClick={() => handleOpenLocalize("description")}
					data-testid="skill-description-localize-button"
				>
					<Globe className="size-4" />
				</Button>
			</div>

			{/* Localize dialog */}
			{localizeOpen && (
				<LocalizeDialog
					open={localizeOpen}
					defaultTab={localizeField}
					identity={identity}
					onConfirm={handleLocalizeConfirm}
					onCancel={() => setLocalizeOpen(false)}
				/>
			)}
		</div>
	)
}

export default memo(IdentityStep)
