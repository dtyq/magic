interface SlidesTemplateFolderIconProps {
	size?: number
	className?: string
}

/** PPT 项目图标的模板变体：只调整文档背景色。 */
export function SlidesTemplateFolderIcon({ size = 16, className }: SlidesTemplateFolderIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 25 24"
			fill="none"
			aria-hidden="true"
			className={className}
			data-testid="slides-template-folder-icon"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M16.263 0L23.5 7.237V22C23.5 22.5304 23.2893 23.0391 22.9142 23.4142C22.5391 23.7893 22.0304 24 21.5 24H3.5C2.96957 24 2.46086 23.7893 2.08579 23.4142C1.71071 23.0391 1.5 22.5304 1.5 22V2C1.5 1.46957 1.71071 0.960859 2.08579 0.585786C2.46086 0.210714 2.96957 0 3.5 0L16.263 0Z"
				fill="#7C6CF2"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M18.263 7.237C17.7326 7.237 17.2239 7.02629 16.8488 6.65121C16.4737 6.27614 16.263 5.76743 16.263 5.237V0L23.5 7.237H18.263Z"
				fill="white"
				fillOpacity="0.401"
			/>
			<path
				d="M8.40399 11.147H15.575C16.689 11.147 17.592 12.094 17.592 13.262C17.592 14.431 16.689 15.378 15.575 15.378H8.40499V18.858"
				stroke="white"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
