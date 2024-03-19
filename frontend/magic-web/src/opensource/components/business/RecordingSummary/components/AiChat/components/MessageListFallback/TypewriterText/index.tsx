import { useEffect, useState } from "react"
import { createStyles, cx } from "antd-style"

interface TypewriterTextProps {
	text: string
	className?: string
	speed?: number
	punctuationDelay?: number
}

const useStyles = createStyles(({ css, token }) => ({
	text: css`
		display: inline-block;
	`,
	cursor: css`
		display: inline-block;
		width: 2px;
		height: 1em;
		margin-left: 2px;
		background-color: ${token.colorText || "currentColor"};
		animation: blink 1s step-end infinite;
		vertical-align: baseline;
		transform: translateY(3px);

		@keyframes blink {
			0%,
			50% {
				opacity: 1;
			}
			51%,
			100% {
				opacity: 0;
			}
		}
	`,
}))

function TypewriterText({
	text,
	className,
	speed = 50,
	punctuationDelay = 300,
}: TypewriterTextProps) {
	const { styles } = useStyles()
	const [displayedText, setDisplayedText] = useState("")
	const [currentIndex, setCurrentIndex] = useState(0)

	// Check if character is punctuation
	const isPunctuation = (char: string): boolean => {
		return /[，。！？、；：,.!?;:]/.test(char)
	}

	useEffect(() => {
		if (currentIndex >= text.length) return

		const currentChar = text[currentIndex]
		// Check if previous character was punctuation
		const prevChar = currentIndex > 0 ? text[currentIndex - 1] : ""
		// If previous char was punctuation, add delay after it
		const delay = isPunctuation(prevChar) ? punctuationDelay + speed : speed

		const timer = setTimeout(() => {
			setDisplayedText((prev) => prev + currentChar)
			setCurrentIndex((prev) => prev + 1)
		}, delay)

		return () => clearTimeout(timer)
	}, [currentIndex, text, speed, punctuationDelay])

	// Reset when text changes
	useEffect(() => {
		setDisplayedText("")
		setCurrentIndex(0)
	}, [text])

	const isTyping = currentIndex < text.length

	return (
		<span className={cx(styles.text, className)}>
			{displayedText}
			{isTyping && <span className={styles.cursor} />}
		</span>
	)
}

export default TypewriterText
