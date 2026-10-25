import type { ChangeEventHandler, ClipboardEventHandler, RefObject } from "react"
import { ImagePlus, Loader2, RefreshCw, Settings2, Trash2, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { PublishedMicroAppProjectItem } from "@/apis/modules/superMagic"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Separator } from "@/components/shadcn-ui/separator"
import { Switch } from "@/components/shadcn-ui/switch"
import { cn } from "@/utils/cn"
import {
	ShareRangeField,
	ShareExpiryField,
	ShareTypeField,
	type ShareRange,
	type ShareTarget,
} from "@/pages/superMagic/components/Share/ShareFields"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import MicroAppEntryFileSelect from "./MicroAppEntryFileSelect"
import MicroAppMobileExpiryField from "./MicroAppMobileExpiryField"

import type {
	MicroAppPublishFormState,
	MicroAppPublishValidationError,
} from "./microAppPublishDialogUtils"
import MicroAppPublishedSection from "./MicroAppPublishedSection"

interface MicroAppPublishDialogContentProps {
	mobile: boolean
	isPersonalOrganization: boolean
	appId?: string
	formState: MicroAppPublishFormState
	publishedItem: PublishedMicroAppProjectItem | null
	publishedAtText: string
	accessUrl: string
	hasPublished: boolean
	hasUnsavedPublishedChanges: boolean
	permittedShareTypes?: ShareType[]
	isSelectedShareTypePermitted: boolean
	shareTypePermissionLoading: boolean
	loading: boolean
	saving: boolean
	unpublishing: boolean
	coverUploading: boolean
	coverUploadError: boolean
	validationError: MicroAppPublishValidationError | null
	validationMessage: string
	coverInputRef: RefObject<HTMLInputElement | null>
	onAppNameChange: ChangeEventHandler<HTMLInputElement>
	onCoverChange: ChangeEventHandler<HTMLInputElement>
	onCoverFile: (file: File) => void
	onClearCover: () => void
	onFullScreenChange: (value: boolean) => void
	onShareTypeChange: (shareType: ShareType) => void
	onShareRangeChange: (shareRange: ShareRange) => void
	onTargetsChange: (targets: ShareTarget[]) => void
	onShareExpiryChange: (value: number | null) => void
	attachmentList: AttachmentItem[]
	onDefaultOpenFileChange: (value: string | null) => void
	onPasswordChange: ChangeEventHandler<HTMLInputElement>
	onPasswordReset: () => void
	onCopyAccessUrl: () => void
	onCopyShareText: () => void
	onUnpublish: () => void
	onClose: () => void
	onSave: () => void
}

const MICRO_APP_PUBLISH_TYPES = [
	ShareType.Organization,
	ShareType.Public,
	ShareType.PasswordProtected,
]
const PERSONAL_MICRO_APP_PUBLISH_TYPES = MICRO_APP_PUBLISH_TYPES.filter(
	(type) => type !== ShareType.Organization,
)

/** 发布表单展示层，桌面弹窗和移动端底部弹窗共用同一份字段与操作。 */
export default function MicroAppPublishDialogContent({
	mobile,
	isPersonalOrganization,
	appId,
	formState,
	publishedItem,
	publishedAtText,
	accessUrl,
	hasPublished,
	hasUnsavedPublishedChanges,
	permittedShareTypes,
	isSelectedShareTypePermitted,
	shareTypePermissionLoading,
	loading,
	saving,
	unpublishing,
	coverUploading,
	coverUploadError,
	validationError,
	validationMessage,
	coverInputRef,
	onAppNameChange,
	onCoverChange,
	onCoverFile,
	onClearCover,
	onFullScreenChange,
	onShareTypeChange,
	onShareRangeChange,
	onTargetsChange,
	onShareExpiryChange,
	attachmentList,
	onDefaultOpenFileChange,
	onPasswordChange,
	onPasswordReset,
	onCopyAccessUrl,
	onCopyShareText,
	onUnpublish,
	onClose,
	onSave,
}: MicroAppPublishDialogContentProps) {
	const { t } = useTranslation("super")
	const isBusy = saving || unpublishing || coverUploading
	// 全部分享方式被管理员管控关闭时，分享设置里只有方式与提示有意义，其余项不再渲染。
	const hasNoPermittedShareType = permittedShareTypes?.length === 0
	const handleCoverPaste: ClipboardEventHandler<HTMLDivElement> = (event) => {
		if (loading || isBusy) return
		const target = event.target
		// 输入区域优先保留原生粘贴行为，避免图文剪贴板内容被误识别为封面上传。
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA")
		) {
			return
		}
		const clipboardFiles = Array.from(event.clipboardData.files ?? [])
		const imageFile =
			clipboardFiles.find((file) => file.type.startsWith("image/")) ??
			Array.from(event.clipboardData.items ?? [])
				.find((item) => item.kind === "file" && item.type.startsWith("image/"))
				?.getAsFile()

		if (!imageFile) return
		event.preventDefault()
		onCoverFile(imageFile)
	}

	return (
		<div
			className={cn(
				mobile
					? "flex min-h-0 flex-1 flex-col overflow-hidden"
					: "grid max-h-[80dvh] min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden",
				!mobile && (loading || hasPublished) && "h-[80dvh]",
			)}
			data-testid="micro-app-publish-dialog"
			data-mobile={mobile ? "true" : undefined}
			onPaste={handleCoverPaste}
		>
			{/* 顶部发布状态和下方设置共用单列轨道，避免跨列元素生成隐式空白列。 */}
			{!mobile ? (
				<div
					className={cn(
						"grid min-h-0 min-w-0 grid-cols-1 gap-4 p-5",
						loading || hasPublished
							? "grid-rows-[auto_minmax(0,1fr)]"
							: "grid-rows-[minmax(0,1fr)]",
					)}
				>
					{loading ? (
						<div
							className="h-[156px] rounded-lg border border-emerald-200/70 bg-emerald-50/40"
							aria-hidden="true"
						/>
					) : hasPublished ? (
						<MicroAppPublishedSection
							mobile={false}
							publishedAtText={publishedAtText}
							accessUrl={accessUrl}
							hasUnsavedPublishedChanges={hasUnsavedPublishedChanges}
							onCopyAccessUrl={onCopyAccessUrl}
							onCopyShareText={onCopyShareText}
						/>
					) : null}
					<div
						className="grid min-h-0 min-w-0 grid-cols-2 items-start gap-4"
						data-testid="micro-app-publish-basic-settings"
					>
						{/* 两个面板共享受限轨道高度，内容只在各自 ScrollArea 内滚动，避免遮挡底部操作区。 */}
						<ScrollArea
							className="h-full min-h-0 min-w-0 self-stretch rounded-lg bg-muted/60"
							data-testid="micro-app-publish-scroll-area"
						>
							<div className="min-w-0 space-y-4 p-3">
								<div>
									<Label htmlFor="micro-app-publish-project-name">
										{t("microAppPage.publish.projectName")}
									</Label>
									<Input
										id="micro-app-publish-project-name"
										value={formState.appName}
										onChange={onAppNameChange}
										maxLength={100}
										className="mt-2 h-9 bg-background"
										data-testid="micro-app-publish-project-name"
									/>
									<p className="mt-1 text-xs text-muted-foreground">
										{t("microAppPage.publish.description")}
									</p>
									<div className="mt-4">
										<div className="flex items-center justify-between gap-3">
											<div>
												<Label>{t("microAppPage.publish.cover")}</Label>
												<p className="mt-1 text-xs text-muted-foreground">
													{t("microAppPage.publish.coverDescription")}
												</p>
											</div>
											<input
												ref={coverInputRef}
												type="file"
												accept="image/*"
												className="hidden"
												onChange={onCoverChange}
												data-testid="micro-app-cover-input"
											/>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => coverInputRef.current?.click()}
												disabled={coverUploading || saving}
												data-testid="micro-app-cover-upload"
											>
												<ImagePlus className="mr-1.5 size-3.5" />
												{t("microAppPage.publish.coverUpload")}
											</Button>
											{formState.coverFileKey !== undefined ||
											formState.coverUrl ? (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={onClearCover}
													data-testid="micro-app-cover-clear"
													aria-label={t(
														"microAppPage.publish.coverClear",
													)}
												>
													<X className="size-4" />
												</Button>
											) : null}
										</div>
										<div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
											{formState.coverUrl ? (
												<img
													src={formState.coverUrl}
													alt=""
													className="h-28 w-full object-cover"
													data-testid="micro-app-cover-preview"
												/>
											) : (
												<div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
													{formState.coverFileKey
														? t("microAppPage.publish.coverSet")
														: t("microAppPage.publish.coverEmpty")}
												</div>
											)}
										</div>
									</div>
								</div>
								<div className="border-t border-border/60 pt-4">
									<Label htmlFor="micro-app-default-open-file">
										{t("microAppPage.publish.defaultOpenFile")}
									</Label>
									<MicroAppEntryFileSelect
										attachmentList={attachmentList}
										value={formState.defaultOpenFileId}
										onChange={onDefaultOpenFileChange}
										disabled={isBusy || loading}
										mobile={mobile}
									/>
									<p className="mt-1 text-xs text-muted-foreground">
										{t("microAppPage.publish.defaultOpenFileDescription")}
									</p>
								</div>
								<div
									className="border-t border-border/60 pt-4"
									data-testid="micro-app-publish-display-settings"
								>
									<div className="flex items-center gap-2 text-sm font-medium">
										<Settings2 className="size-4 text-muted-foreground" />
										{t("microAppPage.publish.displaySettings")}
									</div>
									<div className="mt-3 flex items-start gap-3">
										<Switch
											id="micro-app-publish-full-screen"
											data-testid="micro-app-publish-full-screen"
											checked={formState.fullScreen}
											onCheckedChange={onFullScreenChange}
											disabled={isBusy}
										/>
										<div>
											<Label htmlFor="micro-app-publish-full-screen">
												{t("microAppPage.publish.fullScreen")}
											</Label>
											<p className="mt-1 text-xs text-muted-foreground">
												{t("microAppPage.publish.fullScreenDescription")}
											</p>
										</div>
									</div>
								</div>
							</div>
						</ScrollArea>
						<ScrollArea
							className="h-full min-h-0 min-w-0 self-stretch rounded-lg bg-muted/20"
							data-testid="micro-app-publish-share-panel"
						>
							<div className="min-w-0 space-y-5 p-3">
								<div>
									<ShareTypeField
										value={formState.shareType as ShareType}
										onChange={onShareTypeChange}
										availableTypes={
											isPersonalOrganization
												? PERSONAL_MICRO_APP_PUBLISH_TYPES
												: MICRO_APP_PUBLISH_TYPES
										}
										permittedTypes={permittedShareTypes}
										preserveCurrentType={hasPublished}
									/>
									{hasNoPermittedShareType ? (
										<p className="text-sm text-destructive" role="alert">
											{t("share.noAvailableShareMethods")}
										</p>
									) : !isSelectedShareTypePermitted ? (
										<p className="text-sm text-destructive" role="alert">
											{t("share.currentShareMethodUnavailable")}
										</p>
									) : null}
									{!hasNoPermittedShareType && (
										<>
											{!isPersonalOrganization &&
											formState.shareType === ShareType.Organization ? (
												<ShareRangeField
													value={formState.shareRange}
													onChange={onShareRangeChange}
													targets={formState.targets}
													onTargetsChange={onTargetsChange}
													resourceId={publishedItem?.resource_id}
												/>
											) : null}
											<div className="mt-4">
												<ShareExpiryField
													value={formState.shareExpiry}
													onChange={onShareExpiryChange}
												/>
											</div>
										</>
									)}
								</div>
								{!hasNoPermittedShareType &&
								formState.shareType === ShareType.PasswordProtected ? (
									<div>
										<Label htmlFor="micro-app-publish-password">
											{t("microAppPage.publish.password")}
										</Label>
										<div className="mt-2 flex gap-2">
											<Input
												id="micro-app-publish-password"
												data-testid="micro-app-publish-password"
												value={formState.password}
												onChange={onPasswordChange}
												maxLength={32}
												className="h-9"
											/>
											<Button
												type="button"
												variant="outline"
												size="icon"
												className="size-9"
												onClick={onPasswordReset}
											>
												<RefreshCw className="size-4" />
											</Button>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{t("microAppPage.publish.passwordHint")}
										</p>
									</div>
								) : null}
							</div>
						</ScrollArea>
					</div>
				</div>
			) : null}
			{mobile ? (
				<div className="flex min-h-0 flex-1 flex-col">
					{/* 移动端弹窗把滚动区和底部操作区拆成独立轨道，避免表单内容撑开 popup。 */}
					<ScrollArea
						className="min-h-0 flex-1 px-4"
						viewportClassName="touch-pan-y [&>div]:!block"
						data-testid="micro-app-publish-scroll-area"
					>
						<div className="flex flex-col gap-4 pb-5 pt-1">
							{!loading && hasPublished ? (
								<MicroAppPublishedSection
									className="w-full"
									mobile={mobile}
									publishedAtText={publishedAtText}
									accessUrl={accessUrl}
									hasUnsavedPublishedChanges={hasUnsavedPublishedChanges}
									onCopyAccessUrl={onCopyAccessUrl}
									onCopyShareText={onCopyShareText}
								/>
							) : null}

							<div
								className="rounded-t-lg bg-muted/60 p-3"
								data-testid="micro-app-publish-basic-settings"
							>
								<div>
									<Label htmlFor="micro-app-publish-project-name">
										{t("microAppPage.publish.projectName")}
									</Label>
									<Input
										id="micro-app-publish-project-name"
										value={formState.appName}
										onChange={onAppNameChange}
										maxLength={100}
										className={cn(
											"mt-2 bg-background",
											mobile ? "h-11" : "h-9",
										)}
										data-testid="micro-app-publish-project-name"
									/>
									<p className="mt-1 text-xs text-muted-foreground">
										{t("microAppPage.publish.description")}
									</p>
								</div>

								<div className="mt-4">
									<div className="flex items-center justify-between gap-3">
										<div>
											<Label>{t("microAppPage.publish.cover")}</Label>
											<p className="mt-1 text-xs text-muted-foreground">
												{t("microAppPage.publish.coverDescription")}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											<input
												ref={coverInputRef}
												type="file"
												accept="image/*"
												className="hidden"
												onChange={onCoverChange}
												data-testid="micro-app-cover-input"
											/>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => coverInputRef.current?.click()}
												disabled={coverUploading || loading || saving}
												data-testid="micro-app-cover-upload"
											>
												{coverUploading ? (
													<Loader2 className="mr-1.5 size-3.5 animate-spin" />
												) : (
													<ImagePlus className="mr-1.5 size-3.5" />
												)}
												{t("microAppPage.publish.coverUpload")}
											</Button>
											{formState.coverFileKey !== undefined ||
											formState.coverUrl ? (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-8 text-muted-foreground"
													onClick={onClearCover}
													aria-label={t(
														"microAppPage.publish.coverClear",
													)}
													data-testid="micro-app-cover-clear"
												>
													<X className="size-4" />
												</Button>
											) : null}
										</div>
									</div>
									<div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
										{formState.coverUrl ? (
											<img
												src={formState.coverUrl}
												alt=""
												className={cn(
													"w-full object-cover",
													mobile ? "h-32" : "h-28",
												)}
												data-testid="micro-app-cover-preview"
											/>
										) : (
											<div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
												{formState.coverFileKey
													? t("microAppPage.publish.coverSet")
													: t("microAppPage.publish.coverEmpty")}
											</div>
										)}
									</div>
								</div>
							</div>

							{loading ? (
								<div
									className="flex min-h-48 items-center justify-center text-muted-foreground"
									data-testid="micro-app-publish-loading"
								>
									<Loader2 className="size-6 animate-spin" />
								</div>
							) : (
								<>
									<div
										id="micro-app-publish-share-settings"
										className="space-y-4"
									>
										<ShareTypeField
											value={formState.shareType as ShareType}
											onChange={onShareTypeChange}
											availableTypes={
												isPersonalOrganization
													? PERSONAL_MICRO_APP_PUBLISH_TYPES
													: MICRO_APP_PUBLISH_TYPES
											}
											permittedTypes={permittedShareTypes}
											preserveCurrentType={hasPublished}
										/>
										{hasNoPermittedShareType ? (
											<p className="text-sm text-destructive" role="alert">
												{t("share.noAvailableShareMethods")}
											</p>
										) : !isSelectedShareTypePermitted ? (
											<p className="text-sm text-destructive" role="alert">
												{t("share.currentShareMethodUnavailable")}
											</p>
										) : null}

										{!hasNoPermittedShareType ? (
											<>
												{!isPersonalOrganization &&
												formState.shareType === ShareType.Organization ? (
													<ShareRangeField
														value={formState.shareRange}
														onChange={onShareRangeChange}
														targets={formState.targets}
														onTargetsChange={onTargetsChange}
														resourceId={publishedItem?.resource_id}
													/>
												) : null}

												<MicroAppMobileExpiryField
													value={formState.shareExpiry}
													onChange={onShareExpiryChange}
												/>
											</>
										) : null}
									</div>

									{!hasNoPermittedShareType &&
									formState.shareType === ShareType.PasswordProtected ? (
										<div
											className={cn(
												"flex flex-col gap-2",
												!mobile && "col-start-2 row-start-3",
											)}
										>
											<Label htmlFor="micro-app-publish-password">
												{t("microAppPage.publish.password")}
											</Label>
											<div className="flex items-center gap-2">
												<Input
													id="micro-app-publish-password"
													value={formState.password}
													onChange={onPasswordChange}
													maxLength={32}
													className={mobile ? "h-11" : "h-9"}
													data-testid="micro-app-publish-password"
												/>
												<Button
													type="button"
													variant="outline"
													size="icon"
													className={
														mobile
															? "size-11 shrink-0"
															: "size-9 shrink-0"
													}
													onClick={onPasswordReset}
													aria-label={t(
														"microAppPage.publish.resetPassword",
													)}
												>
													<RefreshCw className="size-4" />
												</Button>
											</div>
											<p className="text-xs text-muted-foreground">
												{t("microAppPage.publish.passwordHint")}
											</p>
										</div>
									) : null}

									<div className="-mt-4 rounded-b-lg bg-muted/60 p-3">
										<div className="flex flex-col gap-2">
											<Label htmlFor="micro-app-default-open-file">
												{t("microAppPage.publish.defaultOpenFile")}
											</Label>
											<MicroAppEntryFileSelect
												attachmentList={attachmentList}
												value={formState.defaultOpenFileId}
												onChange={onDefaultOpenFileChange}
												disabled={isBusy || loading}
												mobile={mobile}
											/>
											<p className="mt-1 text-xs text-muted-foreground">
												{t(
													"microAppPage.publish.defaultOpenFileDescription",
												)}
											</p>
										</div>

										<div
											className="mt-3 border-t border-border/60 px-0 pt-3"
											data-testid="micro-app-publish-display-settings"
										>
											<div className="flex items-center gap-2 text-sm font-medium text-foreground">
												<Settings2 className="size-4 text-muted-foreground" />
												{t("microAppPage.publish.displaySettings")}
											</div>
											<div className="mt-3 flex items-start gap-3">
												<Switch
													id="micro-app-publish-full-screen"
													checked={formState.fullScreen}
													onCheckedChange={onFullScreenChange}
													disabled={isBusy}
													data-testid="micro-app-publish-full-screen"
												/>
												<div className="min-w-0">
													<Label
														htmlFor="micro-app-publish-full-screen"
														className="cursor-pointer text-sm font-medium"
													>
														{t("microAppPage.publish.fullScreen")}
													</Label>
													<p className="mt-1 text-xs leading-5 text-muted-foreground">
														{t(
															"microAppPage.publish.fullScreenDescription",
														)}
													</p>
												</div>
											</div>
										</div>
									</div>
								</>
							)}
						</div>
					</ScrollArea>
				</div>
			) : null}

			<Separator />

			<div
				className={cn(
					"flex gap-3 p-2",
					mobile
						? "shrink-0 flex-col items-stretch pt-3"
						: "items-center justify-between",
				)}
				data-testid="micro-app-publish-actions"
			>
				{hasPublished ? (
					<Button
						type="button"
						variant={mobile ? "destructive" : "ghost"}
						className={cn(
							"gap-2",
							mobile
								? "w-full px-0"
								: "text-destructive hover:bg-destructive/10 hover:text-destructive",
						)}
						onClick={onUnpublish}
						disabled={loading || isBusy || coverUploadError}
						data-testid="micro-app-unpublish-button"
					>
						{unpublishing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Trash2 className="size-4" />
						)}
						{t("microAppPage.publish.unpublish")}
					</Button>
				) : (
					<div />
				)}
				<div className={cn("flex gap-3", mobile ? "flex-col" : "items-center")}>
					{!loading && validationMessage ? (
						<p
							id="micro-app-publish-validation-message"
							className="text-xs text-muted-foreground"
							role="status"
							data-testid="micro-app-publish-validation-message"
						>
							{validationMessage}
						</p>
					) : null}
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							className={mobile ? "h-11 flex-[30%]" : undefined}
							onClick={onClose}
							disabled={isBusy}
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="button"
							className={cn("gap-2", mobile && "h-11 flex-[70%]")}
							onClick={onSave}
							aria-describedby={
								!loading && validationMessage
									? "micro-app-publish-validation-message"
									: undefined
							}
							disabled={
								!appId ||
								loading ||
								isBusy ||
								shareTypePermissionLoading ||
								!isSelectedShareTypePermitted ||
								coverUploadError ||
								Boolean(validationError) ||
								// 如果已发布且没有未保存的变更，则禁用保存按钮
								(hasPublished && !hasUnsavedPublishedChanges)
							}
							data-testid="micro-app-publish-save"
						>
							{saving ? <Loader2 className="size-4 animate-spin" /> : null}
							{hasPublished
								? t("microAppPage.publish.update")
								: t("microAppPage.publish.publish")}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
