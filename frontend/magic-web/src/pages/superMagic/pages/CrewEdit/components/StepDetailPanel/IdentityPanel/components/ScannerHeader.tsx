interface ScannerHeaderProps {
	logoUrl: string
}

export function ScannerHeader({ logoUrl }: ScannerHeaderProps) {
	return (
		<div className="relative h-[215px] w-[100px]">
			<div
				className="absolute left-1/2 top-[26px] h-[215px] w-20 -translate-x-1/2 rounded-xs"
				style={{
					background:
						"linear-gradient(180deg, rgba(255,255,255,0) 0%, #737373 30%, #0a0a0a 60%, #0a0a0a 80%, #737373 100%)",
				}}
			/>
			<div className="absolute left-1/2 top-[120px] h-[60px] w-[100px] -translate-x-1/2 rounded-md bg-gradient-to-b from-gray-200 to-gray-400" />
			<div className="absolute left-1/2 top-[125px] h-[50px] w-[50px] -translate-x-1/2 overflow-hidden rounded-[14px]">
				{logoUrl ? (
					<img src={logoUrl} alt="" className="h-full w-full object-cover" />
				) : null}
			</div>
		</div>
	)
}
