import { cn } from "@/utils/cn"

type PresetPreviewVariant = "cover" | "content"

export function InstagramPresetPreviewCard({
	baseCardClass,
	previewAttrs,
	value,
	variant,
}: {
	baseCardClass: string
	previewAttrs: Record<string, string | undefined>
	value: string
	variant: PresetPreviewVariant
}) {
	switch (value) {
		case "ins-modern":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ins-card ins-cover" : "ins-card ins-content",
						"rounded-[14px] bg-[#fafafa] p-[11%] text-[#111]",
					)}
					{...previewAttrs}
				>
					<div className="absolute inset-[5%] rounded-[12px] border-2 border-[#111]" />
					{variant === "cover" ? (
						<div className="relative z-[1] flex h-full flex-col justify-center">
							<span className="ins-kicker mb-[10%] w-max rounded-full bg-[#e1306c] px-[7%] py-[3%] font-black text-white">
								INSTAGRAM
							</span>
							<h3 className="ins-cover-title text-[2em] font-black leading-[0.95]">
								Modern
								<br />
								Content Kit
							</h3>
							<div className="ins-hl-pink mt-[10%] h-[0.8em] w-[48%] rounded-full bg-[#e1306c]/60" />
						</div>
					) : (
						<div className="ins-stat-grid relative z-[1] grid h-full grid-cols-2 gap-[7%] p-[5%] pt-[18%]">
							{["+34%", "92%", "8.7k", "4x"].map((item) => (
								<div
									key={item}
									className="ins-stat rounded-[8px] border border-[#111] bg-white p-[12%] shadow-[2px_2px_0_#111]"
								>
									<span className="block text-[1.45em] font-black">{item}</span>
									<span className="mt-[8%] block text-[0.72em] text-zinc-500">
										metric
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			)
		case "ins-minimal":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ins-card im-cover" : "ins-card im-content",
						"rounded-[8px] bg-[#fbfaf7] p-[12%] text-[#111]",
					)}

					{...previewAttrs}
				>
					{variant === "cover" ? (
						<>
							<p className="im-cover-eyebrow mb-[14%] text-[0.9em] uppercase tracking-[0.26em] text-[#8b857b]">
								Weekly Digest
							</p>
							<h3 className="im-cover-title text-[2.1em] font-black leading-[0.98]">
								Less noise,
								<br />
								more signal.
							</h3>
							<div className="im-cover-line mt-[18%] h-px w-full bg-[#d6d0c7]" />
						</>
					) : (
						<div className="im-body flex h-full flex-col justify-center gap-[8%]">
							{["Revenue Growth", "Customer Retention", "Churn Rate"].map((item) => (
								<div
									key={item}
									className="im-stat flex items-end justify-between border-b border-[#d6d0c7] pb-[5%]"
								>
									<span className="im-stat-label text-[0.82em] text-[#8b857b]">
										{item}
									</span>
									<span className="im-stat-value font-black">+34%</span>
								</div>
							))}
						</div>
					)}
				</div>
			)
		case "ins-dark":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ins-card id-cover" : "ins-card id-content",
						"rounded-[10px] bg-[#070a13] p-[11%] text-white",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(109,40,217,0.75),transparent_35%)]" />
					{variant === "cover" ? (
						<div className="relative z-[1]">
							<span className="id-cover-badge font-mono text-[#14f1d9]">
								{"// dev tips"}
							</span>
							<h3 className="id-cover-title mt-[14%] text-[2em] font-black leading-[0.98]">
								Ship <span className="id-hl-neon text-[#14f1d9]">Faster</span>
								<br />
								with <span className="id-hl-purple text-[#a855f7]">Tooling</span>
							</h3>
						</div>
					) : (
						<div className="id-terminal relative z-[1] mt-[10%] rounded-[7px] border border-white/15 bg-black/55 p-[8%] font-mono">
							{["npx create-app", "install deps", "npm run dev"].map((item) => (
								<div key={item} className="id-terminal-line mb-[7%]">
									<span className="id-terminal-prompt text-[#14f1d9]">$ </span>
									<span className="id-terminal-cmd">{item}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)
		case "ins-gradient":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ins-card ig-cover" : "ins-card ig-content",
						"rounded-[12px] bg-gradient-to-br from-[#ff7ab6] via-[#7c3aed] to-[#22d3ee] p-[11%] text-white",
					)}

					{...previewAttrs}
				>
					<span className="ig-badge rounded-full bg-white/25 px-[7%] py-[3%] font-black backdrop-blur-sm">
						GROWTH
					</span>
					{variant === "cover" ? (
						<h3 className="ig-cover-title mt-[18%] text-[2.25em] font-black leading-[0.95]">
							Gradient
							<br />
							Playbook
						</h3>
					) : (
						<div className="ig-glass-card absolute inset-x-[10%] bottom-[10%] rounded-[10px] bg-white/20 p-[7%] backdrop-blur-sm">
							<span className="ig-stat-value text-[1.5em] font-black">+34%</span>
							<div className="mt-[8%] h-[0.7em] rounded-full bg-white/55" />
							<div className="mt-[5%] h-[0.7em] w-[72%] rounded-full bg-white/35" />
						</div>
					)}
				</div>
			)
		case "ins-retro":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ins-card ir-cover" : "ins-card ir-content",
						"rounded-[8px] bg-[#f7d08a] p-[11%] text-[#2f1b12]",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-[5%] rounded border border-[#2f1b12]" />
					{variant === "cover" ? (
						<>
							<div className="ir-star text-[2.1em] leading-none text-[#c2410c]">
								✦
							</div>
							<h3 className="ir-cover-title mt-[14%] text-[2em] font-black leading-[0.95]">
								Retro
								<br />
								Creator Club
							</h3>
							<div className="ir-ribbon mt-[14%] h-[0.9em] w-[58%] bg-[#c2410c]" />
						</>
					) : (
						<div className="ir-ticket absolute inset-x-[12%] bottom-[13%] rotate-[-2deg] border-2 border-[#2f1b12] bg-[#fff4bf] p-[9%] shadow-[4px_4px_0_#c2410c]">
							<span className="block font-black text-[#c2410c]">TOP PICKS</span>
							<div className="mt-[8%] space-y-[5%]">
								<div className="h-[0.7em] bg-[#2f1b12]" />
								<div className="h-[0.7em] w-[76%] bg-[#2f1b12]" />
								<div className="h-[0.7em] w-[52%] bg-[#2f1b12]" />
							</div>
						</div>
					)}
				</div>
			)
		default:
			return null
	}
}
