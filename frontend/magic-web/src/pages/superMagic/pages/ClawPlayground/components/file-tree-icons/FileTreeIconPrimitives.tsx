interface CompositeFolderIconProps {
	bottomInnerClassName?: string
	bottomSrc: string
	glyphClassName: string
	glyphSrc: string
	glyphWrapperClassName: string
	name: string
	topSrc: string
	topWrapperClassName: string
}

interface LayeredIconProps {
	baseSrc: string
	name: string
	overlaySrc: string
	overlayWrapperClassName: string
}

interface SimpleFileIconProps {
	name: string
	src: string
}

export function CompositeFolderIcon({
	bottomInnerClassName = "inset-[0_1.61%_0_0]",
	bottomSrc,
	glyphClassName,
	glyphSrc,
	glyphWrapperClassName,
	name,
	topSrc,
	topWrapperClassName,
}: CompositeFolderIconProps) {
	return (
		<div
			className="relative size-4 overflow-hidden"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<div className={`absolute ${topWrapperClassName}`}>
				<img alt="" aria-hidden className="block size-full max-w-none" src={topSrc} />
			</div>
			<div className={`absolute flex items-center justify-center ${glyphWrapperClassName}`}>
				<img
					alt=""
					aria-hidden
					className={`block max-w-none ${glyphClassName}`}
					src={glyphSrc}
				/>
			</div>
			<div className="absolute inset-[48.33%_0_4.17%_0]">
				<div className={`absolute ${bottomInnerClassName}`}>
					<img
						alt=""
						aria-hidden
						className="block size-full max-w-none"
						src={bottomSrc}
					/>
				</div>
			</div>
		</div>
	)
}

export function LayeredIcon({
	baseSrc,
	name,
	overlaySrc,
	overlayWrapperClassName,
}: LayeredIconProps) {
	return (
		<div
			className="relative size-4 shrink-0"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<img alt="" aria-hidden className="block size-full max-w-none" src={baseSrc} />
			<div className={`absolute ${overlayWrapperClassName}`}>
				<img alt="" aria-hidden className="block size-full max-w-none" src={overlaySrc} />
			</div>
		</div>
	)
}

export function SimpleFileIcon({ name, src }: SimpleFileIconProps) {
	return (
		<div
			className="relative size-4 shrink-0"
			data-testid={`claw-playground-file-tree-icon-${name}`}
		>
			<img alt="" aria-hidden className="block size-full max-w-none" src={src} />
		</div>
	)
}
