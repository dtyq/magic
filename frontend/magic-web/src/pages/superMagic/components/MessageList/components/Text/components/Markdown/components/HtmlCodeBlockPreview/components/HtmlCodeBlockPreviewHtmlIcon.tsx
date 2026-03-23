interface HtmlCodeBlockPreviewHtmlIconProps {
	htmlIconId: string
}

export function HtmlCodeBlockPreviewHtmlIcon(props: HtmlCodeBlockPreviewHtmlIconProps) {
	const { htmlIconId } = props

	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			className="size-4"
		>
			<g clipPath={`url(#${htmlIconId}-clip-root)`}>
				<path d="M0 0H16V16H0V0Z" fill="#4B62FC" />
				<g clipPath={`url(#${htmlIconId}-clip-inner)`}>
					<path
						d="M10.6663 9.77767L12.4441 7.99989L10.6663 6.22211M5.33295 6.22211L3.55518 7.99989L5.33295 9.77767M9.11073 4.44434L6.88851 11.5554"
						stroke="white"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</g>
			</g>
			<defs>
				<clipPath id={`${htmlIconId}-clip-root`}>
					<path
						d="M0 6C0 2.68629 2.68629 0 6 0H10C13.3137 0 16 2.68629 16 6V10C16 13.3137 13.3137 16 10 16H6C2.68629 16 0 13.3137 0 10V6Z"
						fill="white"
					/>
				</clipPath>
				<clipPath id={`${htmlIconId}-clip-inner`}>
					<rect
						width="10.6667"
						height="10.6667"
						fill="white"
						transform="translate(2.6665 2.6665)"
					/>
				</clipPath>
			</defs>
		</svg>
	)
}
