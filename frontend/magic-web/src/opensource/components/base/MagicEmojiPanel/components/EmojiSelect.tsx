import { Flex, Popover, Tooltip } from "antd"
import MagicEmoji from "@/opensource/components/base/MagicEmoji"
import { memo, useState, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { replace } from "lodash-es"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import type { EmojiInfo, EmojiJson } from "../types"
import FlexBox from "../../FlexBox"

interface EmojiSelectProps {
	config: EmojiJson
	ns: string
	animatedNs?: string
	emojiClassName?: string
	onEmojiClick?: (emoji: EmojiInfo) => void
	/** 显示 tone panel 的延时 */
	showTonePanelDelay?: number
}

const EmojiSelect = memo(
	({
		config,
		ns,
		animatedNs,
		emojiClassName,
		onEmojiClick,
		showTonePanelDelay = 500,
	}: EmojiSelectProps) => {
		const [popverOpen, setPopverOpen] = useState(false)
		const [tooltipOpen, setTooltipOpen] = useState(false)
		const pressTimeoutRef = useRef<NodeJS.Timeout>()

		const language = replace(useGlobalLanguage(false), "-", "_")

		const handleMouseDown = useMemoizedFn(() => {
			if (config.skinTones) {
				pressTimeoutRef.current = setTimeout(() => {
					setPopverOpen(true)
				}, showTonePanelDelay)
			}
		})

		const handleMouseUp = useMemoizedFn(() => {
			if (pressTimeoutRef.current) {
				clearTimeout(pressTimeoutRef.current)
			}
			// 如果 popover 没有打开，说明是短按，触发 click 事件
			if (!popverOpen) {
				onEmojiClick?.({
					code: config.code,
					ns,
					suffix: ".png",
				})
			}
		})

		const handleMouseLeave = useMemoizedFn(() => {
			if (pressTimeoutRef.current) {
				clearTimeout(pressTimeoutRef.current)
			}
		})

		const content = (
			<Tooltip
				/** 如果 popover 打开，则不显示 tooltip */
				open={tooltipOpen && !popverOpen}
				key={config.code}
				title={config.names[language]}
				onOpenChange={setTooltipOpen}
				getTooltipContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
			>
				<FlexBox
					align="center"
					justify="center"
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					style={{ height: 48 }}
				>
					<MagicEmoji ns={ns} code={config.code} className={emojiClassName} />
				</FlexBox>
			</Tooltip>
		)

		/** 如果 emoji 有 tone，则显示 tone panel */
		if (config.skinTones) {
			return (
				<Popover
					key={config.code}
					open={popverOpen}
					styles={{ body: { padding: 4 } }}
					getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
					content={
						<Flex align="center" gap={4} onMouseLeave={() => setPopverOpen(false)}>
							<EmojiSelect
								key={config.code}
								ns={ns}
								animatedNs={animatedNs}
								config={config}
								emojiClassName={emojiClassName}
								onEmojiClick={onEmojiClick}
							/>
							<div
								style={{
									height: 30,
									width: 1,
									background: colorUsages.border,
								}}
							/>
							{config.skinTones.map((item) => {
								return (
									<EmojiSelect
										key={item.filePath}
										ns={ns}
										animatedNs={animatedNs}
										config={{
											code: item.code,
											names: config.names,
											filePath: item.filePath,
										}}
										emojiClassName={emojiClassName}
										onEmojiClick={onEmojiClick}
									/>
								)
							})}
						</Flex>
					}
				>
					{content}
				</Popover>
			)
		}

		return content
	},
)

export default EmojiSelect
