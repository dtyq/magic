import { useState, useEffect } from "react"

interface TypewriterTextProps {
	text: string
	className?: string
	speed?: number
	punctuationDelay?: number
}

function TypewriterText({
	text,
	className = "",
	speed = 50,
	punctuationDelay = 800,
}: TypewriterTextProps) {
	const [displayText, setDisplayText] = useState("")
	const [currentIndex, setCurrentIndex] = useState(0)

	useEffect(() => {
		if (currentIndex < text.length) {
			const currentChar = text[currentIndex]
			const isPunctuation = ["。", "，", "！", "？", ".", ",", "!", "?"].includes(currentChar)
			const delay = isPunctuation ? punctuationDelay : speed

			const timer = setTimeout(() => {
				setDisplayText((prev) => prev + currentChar)
				setCurrentIndex((prev) => prev + 1)
			}, delay)

			return () => clearTimeout(timer)
		}
	}, [currentIndex, text, speed, punctuationDelay])

	useEffect(() => {
		setDisplayText("")
		setCurrentIndex(0)
	}, [text])

	return <span className={className}>{displayText}</span>
}

export default TypewriterText
