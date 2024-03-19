import { Marpit, Element } from "@marp-team/marpit"
import { createStyles } from "antd-style"
import type { HTMLAttributes } from "react"
import { useEffect, useMemo, useRef } from "react"
import Reveal from "reveal.js"
import "reveal.js/dist/reveal.css"
import "reveal.js/dist/theme/black.css"
import { IconArrowLeft, IconArrowRight, IconHome } from "@tabler/icons-react"

interface MagicMarpitProps extends HTMLAttributes<HTMLDivElement> {
	content: string
}

const useStyles = createStyles(({ css }) => ({
	container: css`
		border: none;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: 8px;
		background-color: black;
		aspect-ratio: 16/9;
		position: relative;
	`,
	controlBar: css`
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: rgba(0, 0, 0, 0.7);
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		z-index: 1000;
	`,
	controlButton: css`
		border: none;
		background: transparent;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			background-color: rgba(255, 255, 255, 0.2);
		}

		&:focus {
			outline: none;
			background-color: rgba(255, 255, 255, 0.2);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	`,
}))

const MagicMarpit = ({ content, className }: MagicMarpitProps) => {
	const deckDivRef = useRef<HTMLDivElement>(null) // reference to deck container div
	const deckRef = useRef<Reveal.Api | null>(null) // reference to deck reveal instance

	const { styles, cx } = useStyles()

	const marpitRef = useRef<Marpit>(
		new Marpit({
			container: [
				new Element("div", { class: "reveal" }),
				new Element("div", { class: "slides" }),
			],
		}),
	)

	const { html, css } = useMemo(() => marpitRef.current.render(content), [content])

	if (deckDivRef.current) {
		deckDivRef.current.style.cssText = css
	}

	useEffect(() => {
		deckRef.current = new Reveal(deckDivRef.current!, {
			transition: "slide",
			width: 1920,
			height: 1080,
			loop: true,
			controls: false, // 禁用默认控制，使用自定义控制
		})

		deckRef.current.initialize().then(() => {
			// good place for event handlers and plugin setups
		})

		return () => {
			try {
				if (deckRef.current) {
					deckRef.current.destroy()
					deckRef.current = null
				}
			} catch (e) {
				console.warn("Reveal.js destroy call failed.")
			}
		}
	}, [content])

	// 导航函数
	const goToFirstSlide = () => {
		if (deckRef.current) {
			deckRef.current.slide(0, 0)
		}
	}

	const goToPrevSlide = () => {
		if (deckRef.current) {
			deckRef.current.prev()
		}
	}

	const goToNextSlide = () => {
		if (deckRef.current) {
			deckRef.current.next()
		}
	}

	if (!content) return null

	return (
		<div className={cx(styles.container, className)} title="marpit">
			<div
				ref={deckDivRef}
				className="reveal"
				dangerouslySetInnerHTML={{
					__html: html,
				}}
			/>

			{/* 自定义控制栏 */}
			<div className={styles.controlBar}>
				{/* 回到第一页按钮 */}
				<button
					className={styles.controlButton}
					onClick={goToFirstSlide}
					aria-label="Go to first slide"
					title="回到第一页"
				>
					<IconHome size={16} />
				</button>

				{/* 上一页按钮 */}
				<button
					className={styles.controlButton}
					onClick={goToPrevSlide}
					aria-label="Previous slide"
					title="上一页"
				>
					<IconArrowLeft size={16} />
				</button>

				{/* 下一页按钮 */}
				<button
					className={styles.controlButton}
					onClick={goToNextSlide}
					aria-label="Next slide"
					title="下一页"
				>
					<IconArrowRight size={16} />
				</button>
			</div>
		</div>
	)
}

export default MagicMarpit
