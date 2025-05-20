import PDFIcon from "@/opensource/pages/superMagic/assets/file_icon/pdf.svg"
import CommonHeader from "@/opensource/pages/superMagic/components/Detail/components/CommonHeader"
import { useRef, useState, useEffect, useCallback } from "react"
import { useStyles } from "./style"
import CommonFooter from "../../components/CommonFooter"
import { useFileUrl } from "@/opensource/pages/superMagic/hooks/useFileUrl"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { Button, Flex, Slider, Space } from "antd"
import { ZoomInOutlined, ZoomOutOutlined, RotateRightOutlined } from "@ant-design/icons"
import { debounce } from "lodash-es"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs`

export default function PDFViewer(props: any) {
	const { styles } = useStyles()
	const {
		type,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		setUserSelectDetail,
		userSelectDetail,
		isFromNode,
		onClose,
		isFullscreen,
		data,
	} = props

	const { file_name, file_id } = data
	const { fileUrl: file_url } = useFileUrl({ file_id })
	const containerRef = useRef<HTMLDivElement>(null)
	const [numPages, setNumPages] = useState<number | null>(null)
	const [loading, setLoading] = useState<boolean>(true)
	const [scale, setScale] = useState<number>(1)
	const [rotation, setRotation] = useState<number>(0)
	const [containerWidth, setContainerWidth] = useState<number>(0)

	// 使用防抖处理resize事件
	const updateContainerWidth = useCallback(
		debounce(() => {
			if (containerRef.current) {
				setContainerWidth(containerRef.current.clientWidth)
			}
		}, 200),
		[setContainerWidth, containerRef],
	)

	// 监听容器尺寸变化
	useEffect(() => {
		const resizeObserver = new ResizeObserver(() => {
			updateContainerWidth()
		})

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current)
			// 初始化宽度
			setContainerWidth(containerRef.current.clientWidth)
		}

		return () => {
			resizeObserver.disconnect()
			updateContainerWidth.cancel()
		}
	}, [updateContainerWidth])

	function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
		setNumPages(numPages)
		setLoading(false)
	}

	// 添加防抖的缩放处理函数
	const debouncedSetScale = useCallback(
		debounce((newScale: number) => {
			setScale(newScale)
		}, 200),
		[],
	)

	const handleZoomIn = () => {
		debouncedSetScale(Math.min(scale + 0.1, 3))
	}

	const handleZoomOut = () => {
		debouncedSetScale(Math.max(scale - 0.1, 0.5))
	}

	const handleRotate = () => {
		setRotation((prev) => (prev + 90) % 360)
	}

	// 计算Page宽度
	const getPageWidth = useCallback(() => {
		return containerWidth ? (containerWidth - 40) * scale : undefined
	}, [containerWidth, scale])

	return (
		<div ref={containerRef} className={styles.pdfViewer}>
			<CommonHeader
				title={file_name}
				icon={<img src={PDFIcon} alt="" />}
				type={type}
				currentAttachmentIndex={currentIndex}
				totalFiles={totalFiles}
				onPrevious={onPrevious}
				onNext={onNext}
				onFullscreen={onFullscreen}
				onDownload={onDownload}
				hasUserSelectDetail={hasUserSelectDetail}
				setUserSelectDetail={setUserSelectDetail}
				isFromNode={isFromNode}
				onClose={onClose}
				isFullscreen={isFullscreen}
			/>
			<div className={styles.pdfContainer}>
				{file_url && (
					<Document
						file={file_url}
						onLoadSuccess={onDocumentLoadSuccess}
						onLoadError={() => setLoading(false)}
						loading={
							<Flex
								flex={1}
								vertical
								align="center"
								justify="center"
								style={{ width: "100%", height: "100%" }}
							>
								<MagicSpin spinning />
							</Flex>
						}
					>
						{Array.from(new Array(numPages), (el, index) => (
							<Page
								key={`page_${index + 1}`}
								pageNumber={index + 1}
								width={getPageWidth()}
								renderTextLayer={true}
								renderAnnotationLayer={true}
								rotate={rotation}
							/>
						))}
					</Document>
				)}
			</div>
			{numPages && file_url && (
				<div className={styles.pdfViewerContainer}>
					<button
						className={styles.zoomButton}
						onClick={handleZoomOut}
						aria-label="Zoom out"
					>
						<ZoomOutOutlined />
					</button>
					<Slider
						className={styles.zoomSlider}
						min={0.5}
						max={3}
						step={0.1}
						value={scale}
						onChange={debouncedSetScale}
						tooltip={{ open: false }}
					/>
					<span className={styles.zoomPercent}>{Math.round(scale * 100)}%</span>
					<button
						className={styles.zoomButton}
						onClick={handleZoomIn}
						aria-label="Zoom in"
					>
						<ZoomInOutlined />
					</button>
					<button
						className={styles.rotateButton}
						onClick={handleRotate}
						aria-label="Rotate PDF"
					>
						<RotateRightOutlined />
					</button>
				</div>
			)}
			{isFromNode && (
				<CommonFooter
					setUserSelectDetail={setUserSelectDetail}
					userSelectDetail={userSelectDetail}
					onClose={onClose}
				/>
			)}
		</div>
	)
}
