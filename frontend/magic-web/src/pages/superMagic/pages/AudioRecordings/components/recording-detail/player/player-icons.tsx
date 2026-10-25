/** Custom SVG for skip back 15 seconds — matches prototype player controls. */
export function SkipBack15Icon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={20}
			height={20}
			viewBox="0 0 20 20"
			fill="none"
			className={className}
			aria-hidden
		>
			<path
				d="M6.66659 16.6667H8.33325C8.55427 16.6667 8.76623 16.5789 8.92251 16.4226C9.07879 16.2663 9.16659 16.0543 9.16659 15.8333V15C9.16659 14.779 9.07879 14.567 8.92251 14.4107C8.76623 14.2545 8.55427 14.1667 8.33325 14.1667H6.66659V11.6667H9.16659M12.4999 15C13.826 15 15.0978 14.4732 16.0355 13.5355C16.9731 12.5979 17.4999 11.3261 17.4999 10C17.4999 8.67392 16.9731 7.40215 16.0355 6.46447C15.0978 5.52678 13.826 5 12.4999 5H3.33325M3.33325 5L5.83325 7.5M3.33325 5L5.83325 2.5M4.16659 11.6667V16.6667"
				stroke="currentColor"
				strokeWidth={1.25}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Custom SVG for skip forward 15 seconds — matches prototype player controls. */
export function SkipForward15Icon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={20}
			height={20}
			viewBox="0 0 20 20"
			fill="none"
			className={className}
			aria-hidden
		>
			<path
				d="M14.1667 7.5L16.6667 5M16.6667 5L14.1667 2.5M16.6667 5H7.5C6.17392 5 4.90215 5.52678 3.96447 6.46447C3.02678 7.40215 2.5 8.67392 2.5 10C2.5 11.3261 3.02678 12.5979 3.96447 13.5355C4.90215 14.4732 6.17392 15 7.5 15M13.3333 16.6667H15C15.221 16.6667 15.433 16.5789 15.5893 16.4226C15.7455 16.2663 15.8333 16.0543 15.8333 15.8333V15C15.8333 14.779 15.7455 14.567 15.5893 14.4107C15.433 14.2545 15.221 14.1667 15 14.1667H13.3333V11.6667H15.8333M10.8333 11.6667V16.6667"
				stroke="currentColor"
				strokeWidth={1.25}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/**
 * 20px expand glyph for the PC collapsed transport row.
 * Uses the same canvas and stroke as the skip icons so it stays sharp, with extra inset so it does not dominate them.
 */
export function ExpandPlayerIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={20}
			height={20}
			viewBox="0 0 20 20"
			fill="none"
			className={className}
			aria-hidden
		>
			<path
				d="M11.667 4.167H15.833V8.333M8.333 15.833H4.167V11.667M15.833 4.167L11.667 8.333M4.167 15.833L8.333 11.667"
				stroke="currentColor"
				strokeWidth={1.25}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
