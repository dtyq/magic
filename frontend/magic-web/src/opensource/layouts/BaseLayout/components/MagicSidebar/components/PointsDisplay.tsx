function PointsDisplay() {
	return (
		<div
			className="flex w-full max-w-8 shrink-0 flex-col items-center justify-center px-0 pb-1.5 pt-0"
			data-testid="sidebar-points-display"
		>
			<div className="mb-[-6px] h-5 w-5 shrink-0 overflow-hidden rounded-full">
				<div
					className="h-5 w-5 rounded-full"
					style={{
						backgroundImage:
							"linear-gradient(128.367deg, rgb(63, 143, 255) 5.5906%, rgb(239, 47, 223) 95.082%)",
					}}
				/>
			</div>
			<div className="mb-[-6px] flex w-full shrink-0 items-center justify-center rounded-full bg-white p-px shadow-sm dark:bg-[#262626]">
				<div className="text-center text-[10px] font-normal leading-3 text-[#0a0a0a] dark:text-[#fafafa]">
					500K
				</div>
			</div>
		</div>
	)
}

export default PointsDisplay
