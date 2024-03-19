import DEFAULT_USER_ICON from "@/opensource/assets/logos/user-avatar.svg"
import UploadAction from "@/opensource/components/base/UploadAction"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { RadioGroup, RadioGroupItem } from "@/opensource/components/shadcn-ui/radio-group"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { useTranslation } from "react-i18next"
import { PROFESSIONAL_IDENTITY_OPTIONS, DISCOVERY_CHANNEL_GROUPS } from "../constant"
import type { useImproveInformationForm } from "../hooks/useImproveInformationForm"

interface ImproveInformationFormProps {
	form: ReturnType<typeof useImproveInformationForm>
}

function ImproveInformationForm({ form }: ImproveInformationFormProps) {
	const { t } = useTranslation("interface")

	const {
		uploading,
		imagePreviewUrl,
		userName,
		setUserName,
		professionalIdentity,
		setProfessionalIdentity,
		discoveryChannel,
		setDiscoveryChannel,
		isLoading,
		isDisabled,
		isDragging,
		onFileChange,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		handleSubmit,
	} = form

	return (
		<div className="flex w-full flex-col">
			{/* Header */}
			<div className="flex flex-col items-center gap-1 px-3 pb-3 pt-6">
				<div className="whitespace-nowrap text-[30px] font-normal leading-none text-foreground">
					{t("completeInformationModal.title")}
				</div>
				<div className="text-center text-sm text-muted-foreground">
					{t("completeInformationModal.subtitle")}
				</div>
			</div>

			{/* Content */}
			<div className="w-full px-3 py-2.5">
				<div className="flex w-full flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
					{/* Avatar Section */}
					<div
						className={[
							"flex w-full items-center gap-4 rounded-lg py-2 transition-colors",
							isDragging
								? "bg-accent/60 px-2 outline-dashed outline-2 outline-border"
								: "",
						].join(" ")}
						onDragEnter={handleDragEnter}
						onDragLeave={handleDragLeave}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
					>
						<div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
							<span className="font-medium text-foreground">
								{t("completeInformationModal.avatar")}
							</span>
							<span className="text-sm text-muted-foreground">
								{t("completeInformationModal.avatarSubtitle")}
							</span>
						</div>

						<div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-background">
							{uploading && (
								<div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/50">
									<MagicSpin spinning size="small" />
								</div>
							)}
							<img
								className="h-full w-full object-cover"
								src={imagePreviewUrl || DEFAULT_USER_ICON}
								draggable={false}
								alt=""
							/>
						</div>

						<UploadAction
							multiple={false}
							accept="image/*"
							handler={(onUpload) => (
								<Button
									variant="outline"
									size="sm"
									className="shrink-0"
									onClick={onUpload}
									type="button"
									aria-label={t("completeInformationModal.upload")}
								>
									{t("completeInformationModal.upload")}
								</Button>
							)}
							onFileChange={onFileChange}
						/>
					</div>

					{/* Username Section */}
					<div className="flex w-full flex-col gap-2 py-2">
						<span className="text-sm font-medium text-foreground">
							{t("completeInformationModal.userName")}
						</span>
						<Input
							type="text"
							maxLength={30}
							placeholder={t("completeInformationModal.userNameInputPlaceholder")}
							value={userName}
							onChange={(e) => setUserName(e.target.value)}
							className="h-9 placeholder:text-sm"
							aria-label={t("completeInformationModal.userName")}
						/>
					</div>

					{/* Professional Identity Section */}
					<div className="flex w-full flex-col gap-2 py-2">
						<span className="text-sm font-medium text-foreground">
							{t("completeInformationModal.professionalIdentity")}
						</span>
						<RadioGroup
							value={professionalIdentity}
							onValueChange={setProfessionalIdentity}
							className="grid cursor-pointer grid-cols-2 gap-2.5"
						>
							{PROFESSIONAL_IDENTITY_OPTIONS.map((option) => {
								const isSelected = professionalIdentity === option.value
								return (
									<label
										key={option.value}
										htmlFor={`identity-${option.value}`}
										className={[
											"flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
											isSelected
												? "border-foreground bg-foreground/5"
												: "border-border hover:bg-accent/50",
										].join(" ")}
									>
										<RadioGroupItem
											value={option.value}
											id={`identity-${option.value}`}
											className="shrink-0"
										/>
										<span className="text-sm font-medium leading-none text-foreground">
											{t(`completeInformationModal.${option.labelKey}`)}
										</span>
									</label>
								)
							})}
						</RadioGroup>
					</div>

					{/* Discovery Channel Section */}
					<div className="flex w-full flex-col gap-2 py-2">
						<span className="text-sm font-medium text-foreground">
							{t("completeInformationModal.discoveryChannel")}
						</span>
						<Select value={discoveryChannel ?? ""} onValueChange={setDiscoveryChannel}>
							<SelectTrigger
								className="h-9 w-full"
								aria-label={t("completeInformationModal.discoveryChannel")}
							>
								<SelectValue
									placeholder={t(
										"completeInformationModal.discoveryChannelPlaceholder",
									)}
								/>
							</SelectTrigger>
							<SelectContent
								className="max-h-60 overflow-y-auto"
								showScrollButtons={false}
							>
								{DISCOVERY_CHANNEL_GROUPS.map((group) => (
									<SelectGroup key={group.groupKey}>
										<SelectLabel className="text-xs text-muted-foreground">
											{t(`completeInformationModal.${group.groupKey}`)}
										</SelectLabel>
										{group.options.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{t(`completeInformationModal.${option.labelKey}`)}
											</SelectItem>
										))}
									</SelectGroup>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-end px-3 py-3">
				<Button
					type="button"
					size="sm"
					disabled={isDisabled}
					onClick={handleSubmit}
					aria-label={t("completeInformationModal.submit")}
					className="w-full sm:w-auto"
				>
					{isLoading ? (
						<MagicSpin spinning size="small" />
					) : (
						t("completeInformationModal.submit")
					)}
				</Button>
			</div>
		</div>
	)
}

export default ImproveInformationForm
