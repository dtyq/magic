import { cn } from "@/lib/utils"
import { memo, useEffect, useMemo, useState, type ReactNode } from "react"

interface TypingHintProps {
	className?: string
	primaryText: string
	secondaryText?: string
	isActive?: boolean
	decoration?: ReactNode
	decorationClassName?: string
	testId?: string
	primaryLineTestId?: string
	secondaryLineTestId?: string
	decorationTestId?: string
}

function TypingHint({
	className,
	primaryText,
	secondaryText = "",
	isActive = true,
	decoration,
	decorationClassName,
	testId,
	primaryLineTestId,
	secondaryLineTestId,
	decorationTestId,
}: TypingHintProps) {
	const primaryCharacters = useMemo(() => Array.from(primaryText), [primaryText])
	const secondaryCharacters = useMemo(() => Array.from(secondaryText), [secondaryText])
	const hasDecoration = Boolean(decoration)
	const [visiblePrimaryCount, setVisiblePrimaryCount] = useState(0)
	const [visibleSecondaryCount, setVisibleSecondaryCount] = useState(0)
	const [isDecorationVisible, setIsDecorationVisible] = useState(false)

	useEffect(() => {
		if (!isActive) {
			setVisiblePrimaryCount(0)
			setVisibleSecondaryCount(0)
			setIsDecorationVisible(false)
			return
		}

		setVisiblePrimaryCount(0)
		setVisibleSecondaryCount(0)
		setIsDecorationVisible(false)

		const timerIds: number[] = []
		let elapsed = 160

		elapsed = scheduleTyping({
			characters: primaryCharacters,
			startAt: elapsed,
			onProgress: setVisiblePrimaryCount,
			timerIds,
		})

		if (secondaryCharacters.length > 0) {
			elapsed += 220
			elapsed = scheduleTyping({
				characters: secondaryCharacters,
				startAt: elapsed,
				onProgress: setVisibleSecondaryCount,
				timerIds,
			})
		}

		if (hasDecoration) {
			timerIds.push(window.setTimeout(() => setIsDecorationVisible(true), elapsed + 180))
		}

		return () => {
			timerIds.forEach((timerId) => window.clearTimeout(timerId))
		}
	}, [hasDecoration, isActive, primaryCharacters, secondaryCharacters])

	return (
		<div
			className={cn("relative flex flex-col gap-0.5 text-center", className)}
			data-testid={testId}
		>
			<p
				className={cn(
					"min-h-[20px] transition-opacity duration-200",
					visiblePrimaryCount > 0 ? "opacity-100" : "opacity-0",
				)}
				data-testid={primaryLineTestId}
			>
				{primaryCharacters.slice(0, visiblePrimaryCount).join("")}
			</p>
			{secondaryText ? (
				<p
					className={cn(
						"min-h-[20px] transition-opacity duration-200",
						visibleSecondaryCount > 0 ? "opacity-100" : "opacity-0",
					)}
					data-testid={secondaryLineTestId}
				>
					{secondaryCharacters.slice(0, visibleSecondaryCount).join("")}
				</p>
			) : null}
			{decoration ? (
				<div
					className={cn(
						"transition-all duration-300",
						isDecorationVisible
							? "translate-y-0 opacity-100"
							: "pointer-events-none translate-y-2 opacity-0",
						decorationClassName,
					)}
					data-testid={decorationTestId}
				>
					{decoration}
				</div>
			) : null}
		</div>
	)
}

function scheduleTyping({ characters, startAt, onProgress, timerIds }: ScheduleTypingOptions) {
	let elapsed = startAt

	characters.forEach((character, index) => {
		elapsed += getCharacterDelay(character)
		timerIds.push(window.setTimeout(() => onProgress(index + 1), elapsed))
	})

	return elapsed
}

function getCharacterDelay(character: string) {
	if (PUNCTUATION_CHARACTERS.has(character)) return 100
	return 30
}

const PUNCTUATION_CHARACTERS = new Set(["。", "，", "！", "？", ".", ",", "!", "?", ":", "："])

interface ScheduleTypingOptions {
	characters: string[]
	startAt: number
	onProgress: (count: number) => void
	timerIds: number[]
}

export default memo(TypingHint)
