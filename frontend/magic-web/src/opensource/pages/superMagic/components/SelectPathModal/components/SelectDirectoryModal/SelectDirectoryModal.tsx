import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from "react"
import { Tooltip, Dropdown, Menu } from "antd"
import { useMemoizedFn, useDebounceFn, useUpdateEffect } from "ahooks"
import {
	IconCheck,
	IconChevronRight,
	IconDots,
	IconLock,
	IconFolderPlus,
	IconSearch,
	IconX,
	IconFolder,
	IconFileSearch,
} from "@tabler/icons-react"
import { isEmpty, last } from "lodash-es"
import { useTranslation } from "react-i18next"

import { cn } from "@/opensource/lib/utils"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import BaseModal from "../BaseModal"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import { AttachmentItem } from "../../../TopicFilesButton/hooks"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import { InputWithError } from "@/opensource/pages/superMagic/components/TopicFilesButton/components"

import type { SelectDirectoryModalProps } from "./types"
import type { BreadcrumbItem } from "../../types"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import {
	getItemName,
	getItemId,
	getDirectoriesFromPath,
	searchInAttachments,
} from "../../utils/attachmentUtils"
import { useCreateDirectory } from "../../hooks/useCreateDirectory"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface SelectDirectoryModalRef {
	resetState: () => void
}

const SelectDirectoryModal = forwardRef<SelectDirectoryModalRef, SelectDirectoryModalProps>(
	function SelectDirectoryModal(
		{
			visible,
			title,
			defaultPath = [],
			onCreateDirectory,
			onClose,
			isShowCreateDirectory = true,
			onSubmit,
			fileType = [],
			placeholder,
			emptyDataTip,
			tips,
			projectId,
			attachments = [],
			okText,
			cancelText,
			disabledFolderIds = [],
		},
		ref,
	) {
		const isMobile = useIsMobile()
		const { t } = useTranslation("super")

		const [loading, setLoading] = useState(false)
		const [path, setPath] = useState<AttachmentItem[]>(defaultPath)
		const [directories, setDirectories] = useState<AttachmentItem[]>([])
		const [isSearch, setIsSearch] = useState(false)
		const [fileName, setFileName] = useState("")
		const [isSearchOpen, setIsSearchOpen] = useState(false)
		const searchInputRef = useRef<HTMLInputElement>(null)

		const isComplete = useRef(false)
		const fetchFilesParamsRef = useRef<{
			value: string
			fileType: string[]
			projectId: string
		}>()

		// 新建文件夹 hook
		const createDirectoryHook = useCreateDirectory({
			projectId,
			path,
			directories,
			onCreateDirectory,
			onDirectoryCreated: async (newDirectory: AttachmentItem, newPath: AttachmentItem[]) => {
				setPath(newPath)
				await fetchDirectories({
					projectId,
					parentId: getItemId(newDirectory),
					pathOverride: newPath,
				})
			},
		})

		// 重置状态函数
		const resetState = useMemoizedFn(() => {
			setLoading(false)
			setPath(defaultPath)
			setDirectories([])
			createDirectoryHook.cancelCreateDirectory()
			setIsSearch(false)
			setFileName("")
			setIsSearchOpen(false)
			isComplete.current = false
			fetchFilesParamsRef.current = undefined
		})

		// 对外暴露重置函数
		useImperativeHandle(
			ref,
			() => ({
				resetState,
			}),
			[resetState],
		)

		useUpdateEffect(() => {
			if (!visible) {
				resetState()
			}
		}, [visible])

		const searchPlaceholder = placeholder || t("selectPathModal.searchDirectory")
		const emptyTip = emptyDataTip || t("selectPathModal.noDirectory")
		const modalTitle = title || t("topicFiles.title")
		const storageLabel = t("selectPathModal.selectStorageLocation")
		const emptyStorageDescription = t("selectPathModal.emptyStorageDescription")
		const emptyStorageAction = t("selectPathModal.emptyStorageAction")
		const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
		const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
			keyword: fileName,
		})

		const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
			let output: BreadcrumbItem[] = [
				{
					name: t("selectPathModal.rootDirectory"),
					id: "0",
					operation: "all",
				},
				...path.map(
					(o) =>
						({
							name: getItemName(o),
							id: getItemId(o),
							operation: "all",
						}) as BreadcrumbItem,
				),
			]

			if (output.length > 5) {
				output = [
					...output.slice(0, 3),
					{ name: "...", id: "ellipsis", children: output.slice(3, -1) },
					...output.slice(-1),
				]
			}
			return output
		}, [path, t])

		// 过滤隐藏文件
		const filesSort = useMemoizedFn((files: AttachmentItem[]) => {
			return files.filter((item) => !item.is_hidden)
		})

		// 获取目录内容（基于 attachments）
		const fetchDirectories = useMemoizedFn(
			async (params: {
				projectId: string
				parentId?: string
				pathOverride?: AttachmentItem[]
			}) => {
				setLoading(true)
				try {
					// 使用 pathOverride 或当前 path 状态
					const currentPath =
						params.pathOverride !== undefined ? params.pathOverride : path
					// 使用 attachments 数据而不是 API 调用，只获取目录
					const dirs = getDirectoriesFromPath(attachments, currentPath)
					setDirectories(filesSort(dirs))
				} catch (error) {
					console.error("Failed to fetch directories:", error)
					setDirectories([])
				}
				setLoading(false)
			},
		)

		const backCatalogueSelect = useMemoizedFn(() => {
			setFileName("")
			const lastPath = last(path)

			fetchDirectories({
				projectId,
				parentId: lastPath ? getItemId(lastPath) : undefined,
			})
			setIsSearch(false)
			setIsSearchOpen(false)
		})

		// 搜索文件（基于 attachments）
		const { run: fetchFiles } = useDebounceFn(
			async (params: { value: string; fileType: string[]; projectId: string }) => {
				fetchFilesParamsRef.current = params
				if (!params.value) {
					// 搜索字符串为空时，退出搜索状态并恢复当前目录内容
					setIsSearch(false)
					const currentPath = last(path)
					await fetchDirectories({
						projectId: params.projectId,
						parentId: currentPath ? getItemId(currentPath) : undefined,
					})
					return
				}

				setIsSearch(true)
				setLoading(true)

				try {
					// 使用 attachments 数据进行搜索
					const searchResults = searchInAttachments(
						attachments,
						params.value,
						params.fileType,
					)
					if (fetchFilesParamsRef.current?.value !== params.value)
						return setLoading(false)
					setDirectories(filesSort(searchResults))
				} catch (error) {
					console.error("Failed to search files:", error)
					setDirectories([])
				}
				setLoading(false)
			},
			{ wait: 400 },
		)

		const searchDirectories = useMemoizedFn(async (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.currentTarget.value
			setFileName(value)

			if (isComplete.current) return
			fetchFiles({
				value,
				fileType,
				projectId,
			})
		})

		const onCompositionStart = useMemoizedFn(() => {
			isComplete.current = true
		})

		const onCompositionEnd = useMemoizedFn((e: React.CompositionEvent<HTMLInputElement>) => {
			isComplete.current = false
			const value = (e.target as HTMLInputElement).value

			setFileName(value)
			fetchFiles({
				value,
				fileType,
				projectId,
			})
		})

		const onBreadcrumbClick = useMemoizedFn(async (item: BreadcrumbItem) => {
			const currentDirectory = last(path)
			if (
				loading ||
				(!currentDirectory && item.id === "0") ||
				(currentDirectory && getItemId(currentDirectory) === item.id)
			) {
				return
			}

			if (!item.operation) {
				magicToast.info(t("selectPathModal.noDirPermission"))
				return
			}

			const index = path.findIndex((o) => getItemId(o) === item.id)
			const newPath = index >= 0 ? path.slice(0, index + 1) : []
			setPath(newPath)
			await fetchDirectories({
				projectId,
				parentId: item.id === "0" ? undefined : item.id,
				pathOverride: newPath, // 传入新路径，避免异步状态问题
			})
			createDirectoryHook.cancelCreateDirectory()
		})

		const onDirectoryClick = useMemoizedFn(async (item: AttachmentItem) => {
			setIsSearch(false)

			if (!item.is_directory) {
				return
			}

			// 检查是否为禁用的文件夹
			const itemId = getItemId(item)
			if (disabledFolderIds.includes(itemId)) {
				magicToast.info(t("selectPathModal.cannotSelectCurrentFolder"))
				return
			}

			const newPath = [...path, item]
			setPath(newPath)
			await fetchDirectories({
				projectId,
				parentId: getItemId(item),
				pathOverride: newPath, // 传入新路径，避免异步状态问题
			})
			createDirectoryHook.cancelCreateDirectory()
		})

		const submit = useMemoizedFn(() => {
			onSubmit && onSubmit({ path })
			onClose && onClose()
		})

		const handleCancel = () => {
			onClose && onClose()
		}

		const handleToggleSearch = useMemoizedFn(() => {
			if (isSearchOpen) {
				setIsSearchOpen(false)
				backCatalogueSelect()
				return
			}

			setIsSearchOpen(true)
		})

		useEffect(() => {
			if (isSearchOpen) {
				searchInputRef.current?.focus()
			}
		}, [isSearchOpen])

		useUpdateEffect(() => {
			if (visible) {
				const lastDefaultPath = last(defaultPath)
				setPath(defaultPath)
				fetchDirectories({
					projectId,
					parentId: lastDefaultPath ? getItemId(lastDefaultPath) : undefined,
					pathOverride: defaultPath,
				})
			}
		}, [visible])

		// 渲染底部配置
		const footerConfig = {
			okText: okText || t("selectPathModal.confirm"),
			cancelText: cancelText || t("common.cancel"),
			onOk: submit,
			onCancel: handleCancel,
			okDisabled: isSearch,
		}

		const handleKeyDown = useMemoizedFn((event: KeyboardEvent) => {
			if (event.key === "Escape") {
				backCatalogueSelect()
			}
		})

		useEffect(() => {
			if (visible) {
				window.addEventListener("keydown", handleKeyDown)
				return () => window.removeEventListener("keydown", handleKeyDown)
			} else {
				window.removeEventListener("keydown", handleKeyDown)
			}
		}, [visible, handleKeyDown])

		// 渲染主要内容
		const toolbarButtonClass =
			"inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-white text-foreground shadow-sm hover:bg-fill active:bg-fill-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-foreground dark:bg-card"
		const breadcrumbItemBase =
			"relative flex max-w-[150px] cursor-pointer items-center rounded-[4px] text-foreground transition-colors hover:not(.disable):not(.current):text-primary [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const modalContent = (
			<div
				className={cn(
					"flex h-full min-h-0 flex-1 flex-col overflow-hidden",
					isMobile && "h-[calc(100%-141px)]",
				)}
			>
				<div
					className="flex items-center justify-start gap-2.5 p-0"
					data-testid="select-directory-modal-toolbar"
				>
					{!isSearchOpen && (
						<div className="whitespace-nowrap text-sm font-medium leading-[14px] text-foreground">
							{storageLabel}
						</div>
					)}
					{isSearchOpen ? (
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<div className="relative min-w-0 flex-1">
								<IconSearch
									size={16}
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									ref={searchInputRef}
									className="h-8 rounded-lg border-border py-1 pl-9 pr-3 text-sm leading-5 placeholder:text-foreground/35"
									placeholder={searchPlaceholder}
									value={fileName}
									onChange={searchDirectories}
									onCompositionStart={onCompositionStart}
									onCompositionEnd={onCompositionEnd}
									data-testid="select-directory-modal-search-input"
								/>
							</div>
							<Button
								variant="outline"
								size="icon"
								className={toolbarButtonClass}
								onClick={handleToggleSearch}
								aria-label={t("common.cancel")}
								data-testid="select-directory-modal-search-close"
							>
								<IconX size={16} />
							</Button>
						</div>
					) : (
						<>
							{!isSearch && (
								<div
									className={cn(
										"m-0 mx-2.5 my-2.5 flex h-auto min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden p-0",
										isMobile && "flex-wrap gap-y-1.5 overflow-visible",
									)}
								>
									{breadcrumbItems.map((item, i) => (
										<div key={i} className="flex items-center">
											{isEmpty(item.children) ? (
												<div
													className={cn(
														breadcrumbItemBase,
														loading && "disable",
													)}
													style={{
														maxWidth:
															breadcrumbItems.length > 1
																? 470 /
																		(breadcrumbItems.length -
																			1) -
																	24
																: undefined,
													}}
													onClick={() => onBreadcrumbClick(item)}
												>
													{!item.operation && (
														<IconLock
															className="mr-0.5 text-xs text-orange-500 dark:text-orange-400"
															size={12}
														/>
													)}
													<Tooltip title={item.name} placement="topLeft">
														<span
															className={cn(
																"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6",
																!isMobile && "md:max-w-[400px]",
															)}
														>
															{item.name}
														</span>
													</Tooltip>
												</div>
											) : (
												<Dropdown
													placement="bottomLeft"
													dropdownRender={() => (
														<Menu>
															{item.children?.map((subitem, j) => (
																<Menu.Item
																	key={j}
																	onClick={() =>
																		onBreadcrumbClick(subitem)
																	}
																>
																	<div className="flex items-center [&_.lock-icon]:mr-0.5 [&_.lock-icon]:text-xs [&_.lock-icon]:text-orange-500 [&_.name]:max-w-[200px] [&_.name]:overflow-hidden [&_.name]:text-ellipsis [&_.name]:whitespace-nowrap">
																		<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
																			<img
																				src={FoldIcon}
																				alt="folder"
																				width={14}
																				height={14}
																			/>
																		</div>
																		{!subitem.operation && (
																			<IconLock
																				className="lock-icon mr-0.5 text-xs text-orange-500 dark:text-orange-400"
																				size={12}
																			/>
																		)}
																		<Tooltip
																			title={subitem.name}
																			placement="topLeft"
																		>
																			<span className="name max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
																				{subitem.name}
																			</span>
																		</Tooltip>
																	</div>
																</Menu.Item>
															))}
														</Menu>
													)}
												>
													<div
														className={cn(
															breadcrumbItemBase,
															"ellipsis p-0.5",
														)}
													>
														<IconDots
															className="mx-1 text-base text-muted-foreground"
															size={16}
														/>
													</div>
												</Dropdown>
											)}
											{i < breadcrumbItems.length - 1 && (
												<IconChevronRight
													className="mx-1 text-xs text-gray-400 dark:text-gray-500"
													size={18}
												/>
											)}
										</div>
									))}
								</div>
							)}
							<div className="ml-auto flex items-center gap-2">
								{isShowCreateDirectory && (
									<Button
										variant="outline"
										size="icon"
										disabled={isSearch}
										className={toolbarButtonClass}
										onClick={createDirectoryHook.showCreateDirectory}
										aria-label={t("selectPathModal.newSubfolder")}
										data-testid="select-directory-modal-create-folder"
									>
										<IconFolderPlus size={20} />
									</Button>
								)}
								<Button
									variant="outline"
									size="icon"
									className={toolbarButtonClass}
									onClick={handleToggleSearch}
									aria-label={t("selectPathModal.searchDirectory")}
									data-testid="select-directory-modal-search-toggle"
								>
									<IconSearch size={20} />
								</Button>
							</div>
						</>
					)}
				</div>
				{tips && <div className="text-xs leading-4 text-foreground/35">{tips}</div>}
				<div className="mt-2.5 h-[282px] w-full overflow-y-auto overflow-x-hidden md:h-auto">
					<MagicSpin
						spinning={loading || createDirectoryHook.loading}
						className="h-full w-full"
					>
						{!isEmpty(directories) || createDirectoryHook.createDirectoryShown ? (
							<>
								{createDirectoryHook.createDirectoryShown && (
									<div
										className={cn(
											"hover:not(.disable):bg-fill mb-0.5 flex h-10 cursor-pointer items-center gap-2 rounded-[4px] p-2.5 transition-all [&.disable]:cursor-not-allowed [&.disable]:opacity-50",
										)}
										data-testid="select-directory-modal-create-directory-row"
									>
										<div className="flex min-w-0 flex-1 items-center gap-1">
											<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
												<img
													src={FoldIcon}
													alt="folder"
													width={14}
													height={14}
												/>
											</div>
											<InputWithError
												height={24}
												className="min-w-0 flex-1 text-sm"
												autoFocus
												size="small"
												value={createDirectoryHook.createDirectoryName}
												onChange={
													createDirectoryHook.onCreateDirectoryInputChange
												}
												onFocus={
													createDirectoryHook.onCreateDirectoryInputFocus
												}
												onPressEnter={
													createDirectoryHook.submitCreateDirectory
												}
												onKeyDown={
													createDirectoryHook.onCreateDirectoryInputKeyDown
												}
												placeholder={t("selectPathModal.inputFolderName")}
												errorMessage={
													createDirectoryHook.createDirectoryErrorMessage
												}
												showError={
													!!createDirectoryHook.createDirectoryErrorMessage
												}
											/>
										</div>
										<div className="flex shrink-0 items-center gap-1">
											<Button
												variant="outline"
												size="icon"
												className="size-8 shrink-0 rounded-md border-border [&_svg]:text-[#10b981]"
												onMouseDown={(e) => e.preventDefault()}
												onClick={createDirectoryHook.submitCreateDirectory}
												disabled={createDirectoryHook.loading}
												aria-label={t("common.confirm")}
												data-testid="select-directory-modal-create-directory-confirm"
											>
												<IconCheck size={14} />
											</Button>
											<Button
												variant="outline"
												size="icon"
												className="size-8 shrink-0 rounded-md border-border [&_svg]:text-[#ef4444]"
												onMouseDown={(e) => e.preventDefault()}
												onClick={createDirectoryHook.cancelCreateDirectory}
												disabled={createDirectoryHook.loading}
												aria-label={t("common.cancel")}
												data-testid="select-directory-modal-create-directory-cancel"
											>
												<IconX size={14} />
											</Button>
										</div>
									</div>
								)}
								{directories.map((directory, index) => {
									const isDisabled =
										disabledFolderIds.includes(getItemId(directory)) ||
										!directory.is_directory
									return (
										<div
											key={index}
											className={cn(
												"hover:not(.disable):bg-fill mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-[4px] p-2.5 transition-all [&.disable]:cursor-not-allowed [&.disable]:opacity-50",
												isDisabled && "disable",
											)}
											onClick={() =>
												!isDisabled && onDirectoryClick(directory)
											}
										>
											<div className="flex w-full flex-1 items-center justify-between gap-2.5">
												<div className="flex flex-1 items-center gap-1">
													<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
														{directory.is_directory ? (
															<img
																src={FoldIcon}
																alt="folder"
																width={14}
																height={14}
															/>
														) : (
															<MagicFileIcon
																type={directory.file_extension}
																size={14}
															/>
														)}
													</div>

													<div className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 md:max-w-[400px]">
														<Tooltip
															title={getItemName(directory)}
															placement="topLeft"
														>
															{getItemName(directory)}
														</Tooltip>
													</div>
												</div>
												{directory.is_directory && (
													<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
														{isSearch &&
															directory.relative_file_path && (
																<MagicEllipseWithTooltip
																	title={
																		directory.relative_file_path
																	}
																	text={
																		directory.relative_file_path
																	}
																	maxWidth="470px"
																	className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm leading-5 text-foreground/35"
																	placement="rightTop"
																>
																	{directory.relative_file_path}
																</MagicEllipseWithTooltip>
															)}
														<IconChevronRight
															className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
															size={16}
														/>
													</div>
												)}
											</div>
										</div>
									)
								})}
							</>
						) : isSearch ? (
							<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
								<div className="flex h-[282px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-white p-6 dark:bg-card">
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm dark:bg-card">
										<IconFileSearch size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="text-lg font-medium leading-7 text-foreground">
											{searchEmptyTitle}
										</div>
										<div className="text-center text-sm font-normal leading-5 text-foreground/35">
											{searchEmptyDescription}
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
								<div className="flex h-[282px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-white p-6 dark:bg-card">
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm dark:bg-card">
										<IconFolder size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="flex flex-col gap-1.5 text-center text-sm font-normal leading-5 text-foreground/35">
											<span>{emptyStorageDescription || emptyTip}</span>
											<Button
												variant="link"
												className="h-auto p-0 leading-5 text-foreground"
												onClick={createDirectoryHook.showCreateDirectory}
												data-testid="select-directory-modal-empty-create-folder"
											>
												{emptyStorageAction}
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}
					</MagicSpin>
				</div>
			</div>
		)

		return (
			<BaseModal
				visible={visible}
				title={modalTitle}
				tips={undefined}
				content={modalContent}
				footer={footerConfig}
				onClose={onClose}
				maskClosable={false}
			/>
		)
	},
)

export default SelectDirectoryModal
