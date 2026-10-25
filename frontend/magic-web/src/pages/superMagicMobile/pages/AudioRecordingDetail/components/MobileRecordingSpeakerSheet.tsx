import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"

interface MobileRecordingSpeakerSheetProps {
	isOpen: boolean
	speakerIds: string[]
	value: Record<string, string>
	onValueChange: (next: Record<string, string>) => void
	onCancel: () => void
	onConfirm: () => void
}

/** Provides the shared mobile speaker editor for standalone and embedded recording previews. */
export function MobileRecordingSpeakerSheet({
	isOpen,
	speakerIds,
	value,
	onValueChange,
	onCancel,
	onConfirm,
}: MobileRecordingSpeakerSheetProps) {
	const { t } = useTranslation("audioRecordings")

	return (
		<MagicPopup
			visible={isOpen}
			onClose={onCancel}
			position="bottom"
			title={t("detail.speakerSettingsTitle")}
			headerVariant="actionHeader"
			headerTitle={t("detail.speakerSettingsTitle")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("detail.speakerSettingsCancel"),
				onClick: onCancel,
				testId: "mobile-recording-speaker-cancel",
			}}
			headerTrailingAction={{
				icon: <Check />,
				ariaLabel: t("detail.speakerSettingsSave"),
				onClick: onConfirm,
				tone: "primary",
				testId: "mobile-recording-speaker-confirm",
			}}
			className="flex flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0"
			bodyClassName="no-scrollbar flex flex-col overflow-y-auto px-[14px] pb-6 pt-[10px]"
			style={{ boxShadow: "0 -14px 44px rgba(0,0,0,0.18)" }}
			data-testid="mobile-recording-speaker-sheet"
		>
			<div className="flex max-h-[min(52dvh,calc(85dvh-11rem))] flex-col overflow-y-auto overflow-x-hidden">
				<p className="shrink-0 px-[14px] pb-2 text-[14px] leading-5 text-muted-foreground">
					{t("detail.speakerSettingsHint")}
				</p>
				<div className="flex flex-col gap-3 pb-2">
					{speakerIds.map((speakerId, index) => (
						<div key={speakerId} className="flex flex-col gap-2">
							<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
								{t("detail.speakerLabel", { label: buildSpeakerAlphaLabel(index) })}
							</p>
							<div className="overflow-hidden rounded-lg bg-card">
								<input
									type="text"
									value={value[speakerId] ?? speakerId}
									onChange={(event) =>
										onValueChange({ ...value, [speakerId]: event.target.value })
									}
									placeholder={speakerId}
									autoComplete="off"
									autoCorrect="off"
									spellCheck={false}
									className="h-12 w-full border-0 bg-transparent px-[14px] py-0 text-[16px] leading-6 text-foreground outline-none"
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</MagicPopup>
	)
}

/** Builds stable A/B/C labels for the speaker list. */
function buildSpeakerAlphaLabel(index: number) {
	return String.fromCharCode("A".charCodeAt(0) + index)
}
