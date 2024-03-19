import type { HTMLAttributes } from "react"
import { useRef, memo, useState } from "react"
import "markmap-toolbar/dist/style.css"
import { Flex, Switch, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { useDebounceEffect, useMemoizedFn, useSize, useUpdateEffect } from "ahooks"
import { IconMaximize, IconPhotoDown } from "@tabler/icons-react"
import { downloadFile } from "@/opensource/utils/file"
import type { IMarkmapOptions } from "markmap-common"
import Divider from "@/opensource/components/other/Divider"
import MagicButton from "../MagicButton"
import MagicIcon from "../MagicIcon"
import ExportPPTButton from "./components/ExportPPTButton"
import { useStyles } from "./styles"
import { exportMarkmapToPng } from "./utils"
import type { MarkmapBaseRef } from "./components/MarkmapBase"
import MarkmapBase from "./components/MarkmapBase"
import MagicModal from "../MagicModal"

interface MagicMarkmapProps extends HTMLAttributes<SVGSVGElement> {
	showToolBar?: boolean
	showTitle?: boolean
	pptData?: string | null
	data: string
	fullScreen?: boolean
	exitFullScreen?: () => void
}

const defaultOptions = (enable: boolean): Partial<IMarkmapOptions> => ({
	autoFit: true,
	pan: enable,
	zoom: enable,
})

const MagicMarkmap = memo(
	({
		data,
		pptData,
		className,
		showTitle = true,
		showToolBar = true,
		fullScreen = false,
		exitFullScreen,
	}: MagicMarkmapProps) => {
		const { styles, cx } = useStyles()
		const { t } = useTranslation("interface")

		const instanceRef = useRef<MarkmapBaseRef | null>(null)
		const containerRef = useRef<HTMLDivElement>(null)
		const [options] = useState<Partial<IMarkmapOptions>>(defaultOptions(fullScreen))
		const [zoomSwitch, setZoomSwitch] = useState(fullScreen)

		useUpdateEffect(() => {
			instanceRef.current?.instance.current?.setOptions(defaultOptions(zoomSwitch))
		}, [zoomSwitch])

		const size = useSize(containerRef.current)

		useDebounceEffect(
			() => {
				if (size && size.width && size.height) {
					instanceRef.current?.instance.current?.fit()
				}
			},
			[size?.width, size?.height],
			{ wait: 500 },
		)

		const [fullScreenOpen, setFullScreenOpen] = useState(false)
		/** 全屏逻辑 */
		const handleFullScreen = useMemoizedFn(() => {
			if (fullScreen) {
				exitFullScreen?.()
			} else {
				setFullScreenOpen(true)
			}
		})

		/** 下载图片 */
		const handleDownloadPicture = useMemoizedFn(() => {
			exportMarkmapToPng(data, 1920, 1080).then((blob) => {
				const url = URL.createObjectURL(blob)
				downloadFile(url, "markmap.png", "png", {
					forceProxy: true,
				})
				URL.revokeObjectURL(url)
			})
		})

		return (
			<div ref={containerRef} className={cx(styles.container, className)}>
				{showToolBar && (
					<Flex
						align="center"
						justify="space-between"
						className={cx(styles.toolbarContainer)}
						gap={4}
					>
						<div className={styles.mindmapTitle}>
							{showTitle ? t("chat.aggregate_ai_search_card.mind_map") : null}
						</div>
						<MagicButton
							className={styles.button}
							type="text"
							onClick={handleFullScreen}
							icon={
								<MagicIcon
									color="currentColor"
									component={IconMaximize}
									size={20}
								/>
							}
						>
							{fullScreen
								? t("chat.markmap.exitFullScreen")
								: t("chat.markmap.fullScreen")}
						</MagicButton>
						<MagicModal
							centered
							width="90vw"
							classNames={{
								body: styles.fullScreenContainer,
							}}
							open={fullScreenOpen}
							title={t("chat.aggregate_ai_search_card.mind_map")}
							onCancel={() => setFullScreenOpen(false)}
							footer={null}
						>
							<MagicMarkmap
								data={data}
								pptData={pptData}
								fullScreen
								showTitle={false}
								exitFullScreen={() => setFullScreenOpen(false)}
							/>
						</MagicModal>
						<MagicButton
							className={styles.button}
							type="text"
							icon={
								<MagicIcon
									color="currentColor"
									component={IconPhotoDown}
									size={20}
								/>
							}
							onClick={handleDownloadPicture}
						>
							{t("chat.markmap.downloadPicture")}
						</MagicButton>
						{!fullScreen ? (
							<>
								<Divider direction="vertical" />
								<Flex
									align="center"
									gap={4}
									style={{ padding: "0 4px", flexShrink: 0 }}
								>
									<Typography.Text className={styles.toolbarText}>
										{t("chat.markmap.enableInteraction")}
									</Typography.Text>
									<Switch
										size="small"
										checked={zoomSwitch}
										onChange={setZoomSwitch}
									/>
								</Flex>
							</>
						) : null}
						<Divider direction="vertical" />
						<ExportPPTButton content={pptData ?? data} />
					</Flex>
				)}
				<MarkmapBase ref={instanceRef} options={options} data={data} />
			</div>
		)
	},
)

export default MagicMarkmap
