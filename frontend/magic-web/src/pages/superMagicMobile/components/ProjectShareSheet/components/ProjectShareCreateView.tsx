import { ChevronDown, ChevronRight, ChevronUp, Globe, Lock, RefreshCw, Users } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ShareRangeField } from "@/pages/superMagic/components/Share/ShareFields"
import { Input } from "@/components/shadcn-ui/input"
import { Switch } from "@/components/shadcn-ui/switch"
import { cn } from "@/utils/cn"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import {
	isShareTypePlanDisabled,
	isShareTypePlanHidden,
} from "@/pages/superMagic/components/Share/utils/sharePlanRestrictions"
import VipIcon from "@/pages/superMagic/components/VipIcon"
import { MobileAttachmentRowIcon } from "@/pages/superMagic/components/TopicFilesButton/components/MobileAttachmentRowIcon"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectShareSheetController } from "../types"
import SelectedFilesHierarchySection from "./SelectedFilesHierarchySection"
import { ProjectShareScrollSpacer } from "./ProjectShareFloatingActionBar"
import { RecordingShareContentPicker } from "@/pages/superMagic/pages/AudioRecordings/components/recording-share/RecordingShareContentPicker"

interface ProjectShareCreateViewProps {
	controller: ProjectShareSheetController
}

/**
 * 渲染原型中的分组标签，统一移动端分享表单的层级样式。
 */
function SectionLabel({ children }: { children: ReactNode }) {
	return <div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">{children}</div>
}

/**
 * 提供白色圆角卡片容器，避免每个表单区块重复声明相同外观。
 */
function CardGroup({ children }: { children: ReactNode }) {
	return <div className="overflow-hidden rounded-[14px] bg-white">{children}</div>
}

/**
 * 文件模式下展示已选文件列表，默认折叠，避免创建页首屏过长。
 */
function SelectedFilesSection({ controller }: { controller: ProjectShareSheetController }) {
	if (controller.enableInlineFileSelection) {
		return null
	}

	if (controller.mode !== "file") {
		return null
	}

	const canEditFileRange = controller.isEditing && !controller.enableInlineFileSelection
	if (controller.selectedFileCount === 0 && !canEditFileRange) {
		return null
	}

	return (
		<SelectedFilesHierarchySection
			hierarchy={controller.selectedFileHierarchy}
			totalCount={controller.selectedFileCount}
			testId="project-share-sheet-selected-files-trigger"
			onEdit={canEditFileRange ? controller.openFileSelector : undefined}
		/>
	)
}

/**
 * Reads the best human-facing name from an attachment item for compact mobile rows.
 */
function getAttachmentDisplayName(item: AttachmentItem): string {
	return item.name || item.file_name || item.display_filename || item.filename || ""
}

/**
 * Shows the current default-open file and delegates selection to the picker shell.
 */
function DefaultOpenFileSection({ controller }: { controller: ProjectShareSheetController }) {
	const { t } = useTranslation("super")
	const defaultOpenFile = controller.defaultOpenFileItem
	// Use the same attachment tree context as the picker so custom folder icons can resolve metadata assets.
	const defaultOpenIconAttachments =
		controller.defaultOpenFileCandidateTree.length > 0
			? controller.defaultOpenFileCandidateTree
			: controller.defaultOpenFileCandidates

	if (controller.enableInlineFileSelection || !defaultOpenFile) {
		return null
	}

	return (
		<div className="space-y-2">
			<SectionLabel>{t("projectShare.defaultOpenFileLabel")}</SectionLabel>
			<CardGroup>
				<button
					type="button"
					onClick={controller.openDefaultOpenFilePicker}
					disabled={controller.defaultOpenFileCandidates.length === 0}
					className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-3 text-left active:opacity-75 disabled:opacity-50"
					data-testid="project-share-sheet-default-open-file-trigger"
				>
					<div className="min-w-0 flex-1">
						<div className="text-[16px] leading-5 text-foreground">
							{t("projectShare.defaultOpenFileLabel")}
						</div>
						<div className="mt-1 truncate text-[13px] leading-[18px] text-muted-foreground">
							{t("projectShare.defaultOpenFileDescription")}
						</div>
					</div>
					<div className="flex min-w-0 shrink items-center gap-2">
						<MobileAttachmentRowIcon
							item={defaultOpenFile}
							attachments={defaultOpenIconAttachments}
							size={16}
							className="block size-4 shrink-0 object-contain"
							dataTestId="project-share-sheet-default-open-file-icon"
						/>
						<span className="max-w-[112px] truncate text-[14px] leading-5 text-foreground">
							{getAttachmentDisplayName(defaultOpenFile)}
						</span>
					</div>
					<ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#8A8A8A]" />
				</button>
			</CardGroup>
		</div>
	)
}

/**
 * 渲染高级设置开关行，将整行点击映射为 Switch 状态切换以适配移动端触控。
 */
function AdvancedSwitchRow({
	label,
	description,
	checked,
	onCheckedChange,
	showDivider,
	testId,
}: {
	label: string
	description: string
	checked: boolean
	onCheckedChange: (value: boolean) => void
	showDivider?: boolean
	testId: string
}) {
	return (
		<>
			<div
				role="button"
				tabIndex={0}
				onClick={() => onCheckedChange(!checked)}
				// 保持整行可键盘触发，避免把外层再实现成 button 导致与 Radix Switch 的 button 根节点嵌套。
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault()
						onCheckedChange(!checked)
					}
				}}
				className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-3 text-left active:opacity-70"
				data-testid={testId}
			>
				<div className="flex-1">
					<div className="text-[16px] leading-5 text-foreground">{label}</div>
					<div className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
						{description}
					</div>
				</div>
				<Switch checked={checked} className="pointer-events-none shrink-0" />
			</div>
			{showDivider ? <div className="mx-3.5 h-px bg-border" /> : null}
		</>
	)
}

/**
 * 创建页按原型独立重画 UI；业务字段仍映射回现有分享保存契约，避免出现“旧表单套新壳”的偏差。
 */
export default function ProjectShareCreateView({ controller }: ProjectShareCreateViewProps) {
	const { t } = useTranslation("super")
	const { formState } = controller
	// 管理员关闭全部分享方式时，除「分享方式 + 红字提示」外的表单项都是死路，直接不再渲染。
	const hasNoPermittedShareType = controller.permittedShareTypes?.length === 0
	const isFreePlan = controller.isFreePlan === true

	const typeCards = useMemo(() => {
		const cards = [
			{
				type: ShareType.PasswordProtected,
				label: t("projectShare.typePassword"),
				icon: Lock,
			},
			{
				type: ShareType.Public,
				label: t("projectShare.typePublic"),
				icon: Globe,
			},
			{
				type: ShareType.Organization,
				label: t("projectShare.typeOrganization"),
				icon: Users,
			},
		]
		return cards.filter((item) => {
			// 免费计划不提供团队内分享，与 PC 端保持同一口径（整项不渲染，而不是禁用）。
			if (isShareTypePlanHidden(item.type, isFreePlan)) return false
			return (
				controller.permittedShareTypes === undefined ||
				controller.permittedShareTypes.includes(item.type) ||
				(controller.isEditing && item.type === formState.shareType)
			)
		})
	}, [controller.isEditing, controller.permittedShareTypes, formState.shareType, isFreePlan, t])

	if (controller.view === "edit" && controller.editLoading) {
		return (
			<div
				className="min-h-70 flex items-center justify-center text-sm text-muted-foreground"
				data-testid="project-share-sheet-edit-loading"
			>
				{t("common.loading")}
				<ProjectShareScrollSpacer
					variant="single"
					testId="project-share-sheet-edit-loading-spacer"
				/>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-2.5" data-testid="project-share-sheet-create-view">
			{!hasNoPermittedShareType && controller.enableInlineFileSelection ? (
				<RecordingShareContentPicker
					groupedItems={controller.groupedShareItems}
					selectedFileIds={controller.selectedFileIds}
					onToggleFileId={controller.toggleShareFileId}
					onSetSelectedFileIds={controller.setSelectedFileIds}
				/>
			) : null}
			{hasNoPermittedShareType ? null : <SelectedFilesSection controller={controller} />}
			<div className="space-y-2">
				<SectionLabel>{t("projectShare.typeLabel")}</SectionLabel>
				<div className="grid grid-cols-3 gap-2" data-testid="project-share-sheet-type-grid">
					{typeCards.map((item) => {
						const Icon = item.icon
						const active = formState.shareType === item.type
						// 付费计划禁用与管理员管控禁用是两种原因，前者可升级解开，所以不能互相顶替。
						const planDisabled = isShareTypePlanDisabled(item.type, isFreePlan)
						const permissionDisabled =
							controller.permittedShareTypes !== undefined &&
							!controller.permittedShareTypes.includes(item.type)
						const disabled = planDisabled || permissionDisabled
						return (
							<button
								key={item.type}
								type="button"
								onClick={() => controller.setShareType(item.type)}
								disabled={disabled}
								className={cn(
									"flex flex-col items-center justify-center gap-2 rounded-[14px] bg-white px-2 py-[18px] text-center transition-all active:opacity-75",
									disabled && "cursor-not-allowed opacity-50",
									active
										? "border-[1.5px] border-foreground shadow-[0_2px_10px_rgba(0,0,0,0.07)]"
										: "border border-transparent",
								)}
								data-testid={`project-share-sheet-type-${item.type}`}
							>
								{/* 固定图标槽高度，VIP 标记比图标矮，避免卡片高度被撑变。 */}
								<div className="flex h-[22px] items-center justify-center">
									{planDisabled ? (
										<VipIcon />
									) : (
										<Icon
											className="h-[22px] w-[22px] text-foreground"
											strokeWidth={1.8}
										/>
									)}
								</div>
								<div className="text-[13px] font-medium leading-4 text-foreground">
									{item.label}
								</div>
							</button>
						)
					})}
				</div>
				{controller.permittedShareTypes?.length === 0 ? (
					<p className="px-3.5 text-sm text-destructive" role="alert">
						{t("share.noAvailableShareMethods")}
					</p>
				) : controller.isSelectedShareTypePermitted === false ? (
					<p className="px-3.5 text-sm text-destructive" role="alert">
						{t("share.currentShareMethodUnavailable")}
					</p>
				) : null}
			</div>

			{hasNoPermittedShareType ? null : (
				<>
					<div className="space-y-2">
						<SectionLabel>{t("projectShare.linkNameLabel")}</SectionLabel>
						<CardGroup>
							<Input
								value={formState.shareName}
								onChange={(event) => controller.setShareName(event.target.value)}
								placeholder={t("projectShare.linkNamePlaceholder")}
								className="h-12 rounded-none border-0 bg-white px-3.5 py-0 text-[16px] text-foreground shadow-none placeholder:text-[#8A8A8A] focus-visible:ring-0"
								data-testid="project-share-sheet-name-input"
							/>
						</CardGroup>
					</div>

					<DefaultOpenFileSection controller={controller} />

					<div className="space-y-2">
						<SectionLabel>{t("projectShare.expiryLabel")}</SectionLabel>
						<CardGroup>
							<button
								type="button"
								className="flex h-12 w-full items-center justify-between px-3.5 text-left active:opacity-75"
								onClick={controller.goToExpiry}
								data-testid="project-share-sheet-expiry-trigger"
							>
								<span className="text-[16px] leading-5 text-foreground">
									{formState.shareExpiry === null
										? t("share.expiryPermanent")
										: t("projectShare.expiryDays", {
												days: formState.shareExpiry,
											})}
								</span>
								<ChevronRight className="h-[18px] w-[18px] text-[#8A8A8A]" />
							</button>
						</CardGroup>
					</div>

					{formState.shareType === ShareType.PasswordProtected ? (
						<div className="space-y-2">
							<SectionLabel>{t("share.accessPassword")}</SectionLabel>
							<CardGroup>
								<div className="flex h-12 items-center">
									<Input
										value={formState.password}
										onChange={(event) =>
											controller.setPassword(event.target.value)
										}
										className="h-12 flex-1 border-0 bg-transparent pl-3.5 pr-2 text-[16px] leading-5 text-foreground shadow-none focus-visible:ring-0"
										data-testid="project-share-sheet-password-input"
									/>
									<div className="h-5 w-px shrink-0 bg-border" />
									<button
										type="button"
										onClick={controller.resetPassword}
										className="flex h-12 w-12 shrink-0 items-center justify-center text-[#8A8A8A] active:opacity-70"
										data-testid="project-share-sheet-password-reset-button"
									>
										<RefreshCw
											className="h-[18px] w-[18px]"
											strokeWidth={1.8}
										/>
									</button>
								</div>
							</CardGroup>
						</div>
					) : null}

					{formState.shareType === ShareType.Organization ? (
						<div
							className="rounded-[14px] bg-white px-3.5 py-3"
							data-testid="project-share-sheet-organization-range"
						>
							<ShareRangeField
								value={formState.shareRange}
								onChange={(range) => {
									controller.setShareRange(range)
									if (range === "all") {
										controller.confirmMemberSelector([])
									}
								}}
								targets={formState.shareTargets}
								onTargetsChange={(targets) => {
									controller.setShareTargets(targets)
								}}
								resourceId={controller.editResourceId}
							/>
						</div>
					) : null}

					<CardGroup>
						<button
							type="button"
							onClick={() => controller.setAdvancedOpen(!controller.advancedOpen)}
							className="flex h-12 w-full items-center justify-between px-3.5 active:opacity-75"
							data-testid="project-share-sheet-advanced-trigger"
						>
							<span className="text-[16px] leading-5 text-foreground">
								{t("projectShare.advancedSettings")}
							</span>
							{controller.advancedOpen ? (
								<ChevronUp className="h-[18px] w-[18px] text-[#8A8A8A]" />
							) : (
								<ChevronDown className="h-[18px] w-[18px] text-[#8A8A8A]" />
							)}
						</button>
						{controller.advancedOpen ? (
							<div className="border-t border-border bg-[#FAFAFA] px-2.5 py-2.5">
								<div className="overflow-hidden rounded-[14px] bg-white">
									<AdvancedSwitchRow
										label={t("share.allowCopyFiles")}
										description={t("share.allowCopyFilesDescription")}
										checked={formState.advancedSettings.allowCopy ?? true}
										onCheckedChange={(value) =>
											controller.setAdvancedSettings({
												...formState.advancedSettings,
												allowCopy: value,
											})
										}
										showDivider
										testId="project-share-sheet-allow-copy-row"
									/>
									<AdvancedSwitchRow
										label={t("share.allowDownloadAndExport")}
										description={t("share.allowDownloadAndExportDescription")}
										checked={
											formState.advancedSettings.allowDownloadProjectFile ??
											true
										}
										onCheckedChange={(value) =>
											controller.setAdvancedSettings({
												...formState.advancedSettings,
												allowDownloadProjectFile: value,
											})
										}
										showDivider
										testId="project-share-sheet-allow-download-row"
									/>
									{!controller.enableInlineFileSelection ? (
										<AdvancedSwitchRow
											label={t("share.viewFileList")}
											description={t("share.viewFileListDescription")}
											checked={
												formState.advancedSettings.showFileList ?? true
											}
											onCheckedChange={(value) =>
												controller.setAdvancedSettings({
													...formState.advancedSettings,
													showFileList: value,
												})
											}
											showDivider
											testId="project-share-sheet-show-file-list-row"
										/>
									) : null}
									<AdvancedSwitchRow
										label={t("share.showOriginalInfo")}
										description={t("share.showOriginalInfoDescription")}
										checked={
											formState.advancedSettings.showOriginalInfo ?? true
										}
										onCheckedChange={(value) =>
											controller.setAdvancedSettings({
												...formState.advancedSettings,
												showOriginalInfo: value,
											})
										}
										showDivider
										testId="project-share-sheet-show-original-row"
									/>
									{/* 与 Web 的 ShareAdvancedSettings 对齐：纯净模式 -> 后端 extra.pure_mode，由共享 hook 负责保存和编辑回填。 */}
									<AdvancedSwitchRow
										label={t("share.pureMode")}
										description={t("share.pureModeDescription")}
										checked={formState.advancedSettings.pureMode ?? false}
										onCheckedChange={(value) =>
											controller.setAdvancedSettings({
												...formState.advancedSettings,
												pureMode: value,
											})
										}
										showDivider
										testId="project-share-sheet-pure-mode-row"
									/>
									<AdvancedSwitchRow
										label={t("share.hideCreatorInfo")}
										description={t("share.hideCreatorInfoDescription")}
										checked={
											formState.advancedSettings.hideCreatorInfo ?? false
										}
										onCheckedChange={(value) =>
											controller.setAdvancedSettings({
												...formState.advancedSettings,
												hideCreatorInfo: value,
											})
										}
										testId="project-share-sheet-hide-creator-row"
									/>
								</div>
							</div>
						) : null}
					</CardGroup>
				</>
			)}

			<ProjectShareScrollSpacer
				variant="single"
				testId="project-share-sheet-create-floating-bar"
			/>
		</div>
	)
}
