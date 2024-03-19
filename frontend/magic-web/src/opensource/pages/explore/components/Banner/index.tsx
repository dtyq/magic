import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { BannerProps } from "./types"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: {
			width: "100%",
			scrollbarWidth: "none",
			position: "relative",
			minHeight: "286px",
		},
		header: css`
			font-size: 14px;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[3]};
		`,
		bannerList: css`
			display: flex;
			gap: 20px;
			cursor: grab;
			cursor: -webkit-grab;
			cursor: -moz-grab;
			overflow: hidden;
			width: 100%;
			user-select: none;
			white-space: nowrap;
			position: absolute;
			top: 0;
			transition: 0.3s all;
			&:active {
				cursor: grabbing;
				cursor: -webkit-grabbing;
				cursor: -moz-grabbing;
			}
		`,
		link: css`
			color: ${isDarkMode
				? token.magicColorUsages.white
				: token.magicColorUsages.link.default};
			font-size: 12px;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
			margin-bottom: 2px;
		`,
		imgBox: css`
			width: 500px;
			height: 204px;
			background: ${isDarkMode
				? token.magicColorUsages.tertiary.default
				: token.magicColorUsages.tertiary.default};
			border-radius: 12px;
		`,
		img: css`
			width: 100%;
		`,
		desc: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[2]};
			font-size: 14px;
			margin: 0;
			line-height: 20px;
		`,
		spin: css`
			justify-content: flex-start;
			position: relative;
		`,
	}
})

function Banner({ data }: BannerProps) {
	const { styles } = useStyles()

	const [isDrag, setIsDrag] = useState(false)
	const [startX, setStartX] = useState(0)
	const [scrollLeft, setScrollLeft] = useState(0)

	const bannersRef = useRef<HTMLDivElement>(null)

	const handleMouseDown = useMemoizedFn((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
		setIsDrag(true)
		if (bannersRef.current) {
			const x = e.clientX - bannersRef.current.offsetLeft
			setStartX(x)
			setScrollLeft(bannersRef?.current?.scrollLeft)
		}
	})

	const handleMouseLeave = useMemoizedFn(() => {
		setIsDrag(false)
	})

	const handleMouseUp = useMemoizedFn(() => {
		setIsDrag(false)
	})

	const handleMouseMove = useMemoizedFn((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
		if (!isDrag) return
		e.preventDefault()
		if (bannersRef.current) {
			const x = e.clientX - bannersRef.current.offsetLeft
			const walk = (x - startX) * 1.5 // 滑动速度因子
			bannersRef.current.scrollLeft = scrollLeft - walk
		}
	})

	return (
		<div className={styles.container}>
			<div
				className={styles.bannerList}
				ref={bannersRef}
				onMouseDown={handleMouseDown}
				onMouseLeave={handleMouseLeave}
				onMouseUp={handleMouseUp}
				onMouseMove={handleMouseMove}
			>
				{data.map((item: any) => {
					return (
						<Flex key={item.id} vertical gap={12}>
							<Flex className={styles.header} gap={2} vertical>
								<div className={styles.link}>{item.link}</div>
								<div className={styles.title}>{item.title}</div>
								<div>{item.desc}</div>
							</Flex>
							<div className={styles.imgBox}>
								<img className={styles.img} alt="" src={item.src} />
							</div>
						</Flex>
					)
				})}
			</div>
		</div>
	)
}

export default Banner
