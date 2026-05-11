export default function VIPTag() {
	return (
		<div className="relative inline-flex h-3 items-center justify-center rounded-full bg-[linear-gradient(128deg,#3f8fff_5.59%,#ef2fdf_95.08%)] px-1 py-px">
			<span className="absolute inset-px z-0 rounded-full bg-background" aria-hidden />
			<span className="relative z-[1] bg-[linear-gradient(128deg,#3f8fff_5.59%,#ef2fdf_95.08%)] bg-clip-text font-[Inter,sans-serif] text-[10px] leading-3 text-transparent">
				VIP
			</span>
		</div>
	)
}
