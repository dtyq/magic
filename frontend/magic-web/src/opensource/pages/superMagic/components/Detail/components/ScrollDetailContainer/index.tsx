import React, {
	memo,
	useRef,
	useState,
	useCallback,
	useImperativeHandle,
	forwardRef,
	ReactNode,
	CSSProperties,
	UIEvent,
	HTMLAttributes,
	useMemo,
} from "react"
import { isEmpty } from "lodash-es"
import { useTranslation } from "react-i18next"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import Render from "../../Render"
import DetailEmpty from "../DetailEmpty"
import BackToLatestButton from "../BackToLatestButton"
import { useStyles } from "./styles"
import { getFileType } from "@/opensource/pages/superMagic/utils/handleFIle"
import { copyFileContent } from "@/opensource/pages/superMagic/utils/share"

interface ScrollDetailContainerProps {
	attachments?: any[]
	attachmentList?: any[]
	setUserSelectDetail?: (detail: any) => void
	userSelectDetail?: any
	onDownload?: (fileId?: string) => void
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	// 新增 viewMode 相关的可选属性
	handleViewModeChange?: (fileId: string, mode: "preview" | "code") => void
	getFileViewMode?: (fileId: string) => "preview" | "code"
}

export interface ScrollDetailContainerRef {
	scrollToFile: (fileId: string) => void
}

// Custom item wrapper component for adding spacing
const ItemWrapper = ({
	children,
	style,
	...props
}: {
	children?: ReactNode
	style?: CSSProperties
} & HTMLAttributes<HTMLDivElement>) => (
	<div {...props} style={{ ...style, marginBottom: "20px" }}>
		{children}
	</div>
)

const ScrollDetailContainer = forwardRef<ScrollDetailContainerRef, ScrollDetailContainerProps>(
	(
		{
			attachments,
			attachmentList,
			setUserSelectDetail,
			userSelectDetail,
			onDownload,
			topicId,
			baseShareUrl,
			handleViewModeChange,
			getFileViewMode,
		},
		ref,
	) => {
		const { styles, cx } = useStyles()
		const containerRef = useRef<HTMLDivElement>(null)
		const virtuosoRef = useRef<VirtuosoHandle>(null)
		const [showBackToLatest, setShowBackToLatest] = useState(false)
		const [fullscreenFileId, setFullscreenFileId] = useState<string | null>(null)
		const [favoriteFiles, setFavoriteFiles] = useState<Set<string>>(new Set())
		const { t } = useTranslation("super")

		// Collect all files (non-directory) and flatten, while filtering out image files
		const collectFiles = useCallback((items: any[]): any[] => {
			let files: any[] = []
			if (!items || !Array.isArray(items)) return files

			items.forEach((item) => {
				if (item.is_directory && Array.isArray(item.children)) {
					files = [...files, ...collectFiles(item.children)]
				} else if (!item.is_directory) {
					files.push(item)
				}
			})
			return files
		}, [])

		// Get all previewable files
		const allFiles = useCallback(() => {
			return collectFiles(attachments || []).reverse()
		}, [attachments, collectFiles])

		const fileList = allFiles()

		// Expose scrollToFile method with virtuoso support
		useImperativeHandle(ref, () => ({
			scrollToFile: (fileId: string) => {
				const fileIndex = fileList.findIndex((file) => file.file_id === fileId)
				if (fileIndex !== -1 && virtuosoRef.current) {
					virtuosoRef.current.scrollToIndex({
						index: fileIndex,
						behavior: "smooth",
						align: "start",
					})
				}
			},
		}))

		// Monitor scroll position to determine whether to show back to latest button
		const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
			const target = e.target as HTMLElement
			if (target) {
				const scrollTop = target.scrollTop
				const scrollHeight = target.scrollHeight
				const clientHeight = target.clientHeight

				// Show back to latest button when not at bottom
				const lastItemVisible = scrollTop + clientHeight >= scrollHeight - 100
				setShowBackToLatest(!lastItemVisible)
			}
		}, [])

		const handleScrollToLatest = () => {
			if (virtuosoRef.current && fileList.length > 0) {
				virtuosoRef.current.scrollToIndex({
					index: fileList.length - 1,
					behavior: "smooth",
					align: "end",
				})
			}
		}

		// Handle fullscreen for specific file
		const handleFileFullscreen = useCallback(
			(fileId: string) => {
				if (fullscreenFileId === fileId) {
					// Exit fullscreen
					setFullscreenFileId(null)
				} else {
					// Enter fullscreen for this file
					setFullscreenFileId(fileId)
				}
			},
			[fullscreenFileId],
		)

		// Handle exit fullscreen (ESC key or other ways)
		const handleExitFullscreen = useCallback(() => {
			setFullscreenFileId(null)
		}, [])

		// Handle copy functionality for files
		const handleCopy = useCallback(
			async (fileId: string, fileContent?: string) => {
				copyFileContent(fileList, t, fileId, fileContent)
			},
			[fileList, t],
		)

		// Handle favorite/unfavorite functionality
		const handleFavorite = useCallback(
			(fileId: string) => {
				setFavoriteFiles((prev) => {
					const newSet = new Set(prev)
					if (newSet.has(fileId)) {
						newSet.delete(fileId)
						magicToast.success(t("common.removeFavoriteSuccess"))
					} else {
						newSet.add(fileId)
						magicToast.success(t("common.addFavoriteSuccess"))
					}
					return newSet
				})
			},
			[t],
		)

		// Handle share functionality
		const handleShare = useCallback((fileId: string) => {
			// For now, just log that share was triggered - actual functionality will be handled by ActionButtons
			console.log("Share triggered for file:", fileId)
		}, [])

		// Listen for ESC key to exit fullscreen
		React.useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.key === "Escape" && fullscreenFileId) {
					handleExitFullscreen()
				}
			}

			if (fullscreenFileId) {
				document.addEventListener("keydown", handleKeyDown)
				return () => document.removeEventListener("keydown", handleKeyDown)
			}
		}, [fullscreenFileId, handleExitFullscreen])

		// Render individual file item
		const renderFileItem = useCallback(
			(index: number, file: any) => {
				const fileName = file.display_filename || file.file_name || file.filename
				const type = getFileType(file.file_extension)
				const isCurrentFileFullscreen = fullscreenFileId === file.file_id
				const viewMode = getFileViewMode?.(file.file_id)

				let fileDetail
				if (type) {
					fileDetail = {
						type,
						data: {
							file_name: fileName,
							file_id: file.file_id,
							file_extension: file.file_extension,
							content: null, // Lazy load content
						},
						currentFileId: file.file_id,
						attachments: attachments,
					}
				} else {
					fileDetail = {
						type: "empty",
						data: {
							text: t("detail.fileNotSupported"),
						},
					}
				}

				const normalItem = (
					<div key={file.file_id || index} className={styles.itemContainer}>
						<div className={styles.itemContent}>
							<Render
								type={fileDetail.type}
								data={fileDetail.data}
								attachments={attachments}
								setUserSelectDetail={setUserSelectDetail}
								currentIndex={index}
								onPrevious={() => {}}
								onNext={() => {}}
								onFullscreen={() => handleFileFullscreen(file.file_id)}
								onDownload={() => onDownload?.(file.file_id)}
								totalFiles={fileList.length}
								hasUserSelectDetail={false}
								isFromNode={false}
								userSelectDetail={userSelectDetail}
								isFullscreen={isCurrentFileFullscreen}
								attachmentList={attachmentList}
								viewMode={viewMode}
								onViewModeChange={(mode: "preview" | "code") =>
									handleViewModeChange?.(file.file_id, mode)
								}
								onCopy={() => handleCopy(file.file_id, file.content)}
								onShare={() => handleShare(file.file_id)}
								onFavorite={() => handleFavorite(file.file_id)}
								fileContent={file.content || ""}
								isFavorited={favoriteFiles.has(file.file_id)}
								// File sharing props
								topicId={topicId}
								baseShareUrl={baseShareUrl}
								currentFile={{
									id: file.file_id || "",
									name: fileName || "",
									type: file.file_extension || "",
									url: file.url || "",
								}}
							/>
						</div>
					</div>
				)

				// If this file is in fullscreen mode, also render the fullscreen content
				if (isCurrentFileFullscreen) {
					return (
						<>
							{normalItem}
							<div className={styles.fullscreenContent}>
								<Render
									type={fileDetail.type}
									data={fileDetail.data}
									attachments={attachments}
									setUserSelectDetail={setUserSelectDetail}
									currentIndex={index}
									onPrevious={() => {}}
									onNext={() => {}}
									onFullscreen={() => handleFileFullscreen(file.file_id)}
									onDownload={() => onDownload?.(file.file_id)}
									totalFiles={fileList.length}
									hasUserSelectDetail={false}
									isFromNode={false}
									userSelectDetail={userSelectDetail}
									isFullscreen={true}
									attachmentList={attachmentList}
									viewMode={viewMode}
									onViewModeChange={(mode: "preview" | "code") =>
										handleViewModeChange?.(file.file_id, mode)
									}
									onCopy={() => handleCopy(file.file_id, file.content)}
									onShare={() => handleShare(file.file_id)}
									onFavorite={() => handleFavorite(file.file_id)}
									fileContent={file.content || ""}
									isFavorited={favoriteFiles.has(file.file_id)}
									// File sharing props
									topicId={topicId}
									baseShareUrl={baseShareUrl}
									currentFile={{
										id: file.file_id || "",
										name: fileName || "",
										type: file.file_extension || "",
										url: file.url || "",
									}}
								/>
							</div>
						</>
					)
				}

				return normalItem
			},
			[
				fullscreenFileId,
				getFileViewMode,
				styles.itemContainer,
				styles.itemContent,
				styles.fullscreenContent,
				attachments,
				setUserSelectDetail,
				fileList.length,
				userSelectDetail,
				attachmentList,
				favoriteFiles,
				t,
				handleFileFullscreen,
				onDownload,
				handleViewModeChange,
				handleCopy,
				handleShare,
				handleFavorite,
				topicId,
				baseShareUrl,
			],
		)

		const virtuosoComponents = useMemo(
			() => ({
				// Custom item wrapper to add spacing
				Item: ItemWrapper,
			}),
			[],
		)

		// If no attachments, show empty state
		if (isEmpty(attachments) && isEmpty(attachmentList)) {
			return (
				<div className={styles.container}>
					<DetailEmpty />
				</div>
			)
		}

		return (
			<div className={styles.container}>
				<div ref={containerRef} className={styles.scrollContainer}>
					<Virtuoso
						ref={virtuosoRef}
						data={fileList}
						itemContent={renderFileItem}
						style={{
							height: "100%",
						}}
						className={cx(styles.virtuosoScroller, {
							[styles.center]: fileList.length === 1,
						})}
						onScroll={handleScroll}
						overscan={5} // Render 5 items outside of visible area for smoother scrolling
						components={virtuosoComponents}
					/>
				</div>

				<BackToLatestButton visible={showBackToLatest} onClick={handleScrollToLatest} />
			</div>
		)
	},
)

export default memo(ScrollDetailContainer)
