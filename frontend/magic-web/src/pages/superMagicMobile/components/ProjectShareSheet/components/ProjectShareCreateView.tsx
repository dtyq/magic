import {
	Building2,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Globe,
	Lock,
	RefreshCw,
	Users,
	X,
} from "lucide-react"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { NodeType, type TreeNode } from "@dtyq/user-selector"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Switch } from "@/components/shadcn-ui/switch"
import { cn } from "@/lib/utils"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import type { ProjectShareSheetController } from "../types"
import SelectedFilesHierarchySection from "./SelectedFilesHierarchySection"
import { ProjectShareFloatingActionBar } from "./ProjectShareFloatingActionBar"

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
	if (controller.mode !== "file" || controller.selectedFileCount === 0) {
		return null
	}

	return (
		<SelectedFilesHierarchySection
			hierarchy={controller.selectedFileHierarchy}
			totalCount={controller.selectedFileCount}
			testId="project-share-sheet-selected-files-trigger"
		/>
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

	const typeCards = useMemo(
		() => [
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
		],
		[t],
	)

	return (
		<div className="flex flex-col gap-2.5" data-testid="project-share-sheet-create-view">
			<SelectedFilesSection controller={controller} />
			<div className="space-y-2">
				<SectionLabel>{t("projectShare.typeLabel")}</SectionLabel>
				<div className="grid grid-cols-3 gap-2" data-testid="project-share-sheet-type-grid">
					{typeCards.map((item) => {
						const Icon = item.icon
						const active = formState.shareType === item.type
						return (
							<button
								key={item.type}
								type="button"
								onClick={() => controller.setShareType(item.type)}
								className={cn(
									"flex flex-col items-center justify-center gap-2 rounded-[14px] bg-white px-2 py-[18px] text-center transition-all active:opacity-75",
									active
										? "border-[1.5px] border-foreground shadow-[0_2px_10px_rgba(0,0,0,0.07)]"
										: "border border-transparent",
								)}
								data-testid={`project-share-sheet-type-${item.type}`}
							>
								<Icon
									className="h-[22px] w-[22px] text-foreground"
									strokeWidth={1.8}
								/>
								<div className="text-[13px] font-medium leading-4 text-foreground">
									{item.label}
								</div>
							</button>
						)
					})}
				</div>
			</div>

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
								: t("projectShare.expiryDays", { days: formState.shareExpiry })}
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
								onChange={(event) => controller.setPassword(event.target.value)}
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
								<RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.8} />
							</button>
						</div>
					</CardGroup>
				</div>
			) : null}

			{formState.shareType === ShareType.Organization ? (
				<div className="space-y-2">
					<SectionLabel>{t("projectShare.organizationMembersLabel")}</SectionLabel>
					<CardGroup>
						<button
							type="button"
							onClick={controller.openMemberSelector}
							className="flex h-12 w-full items-center justify-between px-3.5 active:opacity-75"
							data-testid="project-share-sheet-member-selector-trigger"
						>
							<span className="text-[16px] leading-5 text-foreground">
								{controller.selectedMemberNodes.length > 0
									? t("projectShare.selectedMembersCount", {
											count: controller.selectedMemberNodes.length,
										})
									: t("projectShare.selectMembers")}
							</span>
							<ChevronRight className="h-[18px] w-[18px] text-[#8A8A8A]" />
						</button>
						{controller.selectedMemberNodes.length > 0 ? (
							<div className="border-t border-border px-3.5 py-2">
								{controller.selectedMemberNodes.map((item, index) => (
									<div key={`${item.id}-${index}`}>
										{index > 0 ? <div className="h-px bg-border" /> : null}
										<div className="flex items-center gap-3 py-3">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F3F3]">
												{item.dataType === NodeType.User ? (
													<Users className="h-4 w-4 text-[#8A8A8A]" />
												) : (
													<Building2 className="h-4 w-4 text-[#8A8A8A]" />
												)}
											</div>
											<div className="min-w-0 flex-1 truncate text-[16px] leading-6 text-foreground">
												{item.name}
											</div>
											<button
												type="button"
												onClick={() => {
													const nextNodes =
														controller.selectedMemberNodes.filter(
															(member) => member.id !== item.id,
														)
													controller.setSelectedMemberNodes(nextNodes)
													controller.confirmMemberSelector(nextNodes)
												}}
												className="flex h-7 w-7 items-center justify-center text-[#8A8A8A] active:opacity-70"
												data-testid="project-share-sheet-member-remove-button"
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									</div>
								))}
							</div>
						) : null}
					</CardGroup>
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
									formState.advancedSettings.allowDownloadProjectFile ?? true
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
							<AdvancedSwitchRow
								label={t("share.viewFileList")}
								description={t("share.viewFileListDescription")}
								checked={formState.advancedSettings.showFileList ?? true}
								onCheckedChange={(value) =>
									controller.setAdvancedSettings({
										...formState.advancedSettings,
										showFileList: value,
									})
								}
								showDivider
								testId="project-share-sheet-show-file-list-row"
							/>
							<AdvancedSwitchRow
								label={t("share.showOriginalInfo")}
								description={t("share.showOriginalInfoDescription")}
								checked={formState.advancedSettings.showOriginalInfo ?? true}
								onCheckedChange={(value) =>
									controller.setAdvancedSettings({
										...formState.advancedSettings,
										showOriginalInfo: value,
									})
								}
								showDivider
								testId="project-share-sheet-show-original-row"
							/>
							<AdvancedSwitchRow
								label={t("share.hideCreatorInfo")}
								description={t("share.hideCreatorInfoDescription")}
								checked={formState.advancedSettings.hideCreatorInfo ?? false}
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

			<ProjectShareFloatingActionBar
				scrollSpacerVariant="single"
				testId="project-share-sheet-create-floating-bar"
			>
				<Button
					type="button"
					className="h-12 w-full rounded-xl bg-[#171717] text-[16px] font-medium text-white hover:bg-[#171717] active:opacity-80"
					disabled={controller.saving || controller.isCheckingShare}
					onClick={controller.submitCreateShare}
					data-testid="project-share-sheet-create-submit-button"
				>
					{controller.saving ? t("common.saving") : t("projectShare.createLink")}
				</Button>
			</ProjectShareFloatingActionBar>

			{controller.memberSelectorOpen && (
				<MemberDepartmentSelector
					open={controller.memberSelectorOpen}
					title={t("projectShare.selectMembers")}
					selectedValues={controller.selectedMemberNodes}
					onSelectChange={controller.setSelectedMemberNodes}
					onCancel={controller.closeMemberSelector}
					onOk={(selected: TreeNode[]) => {
						controller.confirmMemberSelector(selected)
					}}
				/>
			)}
		</div>
	)
}
