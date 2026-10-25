import { cn } from "@/utils/cn"
import { InstagramPresetPreviewCard } from "./PresetPreviewInstagramCards"

type PresetPreviewVariant = "cover" | "content"
export function PresetRealCard({
	value,
	variant = "cover",
	compact = false,
	testId,
}: {
	value: string
	variant?: PresetPreviewVariant
	compact?: boolean
	testId?: string
}) {
	const cardSizeClass = compact
		? "h-full min-h-0 scale-[1.02] text-[5px]"
		: "aspect-[3/4] min-h-[176px] text-[6px]"
	const baseCardClass = cn(
		"relative w-full overflow-hidden text-left leading-none shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08),0_10px_22px_rgba(24,24,27,0.08)]",
		cardSizeClass,
	)
	const previewAttrs = {
		"data-preview-content-block": variant === "content" ? "true" : undefined,
		"data-preview-layout": variant,
		"data-testid": testId,
	}

	if (value.startsWith("ins-")) {
		return (
			<InstagramPresetPreviewCard
				baseCardClass={baseCardClass}
				previewAttrs={previewAttrs}
				value={value}
				variant={variant}
			/>
		)
	}

	switch (value) {
		case "neo-brutalism":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "xhs-card is-cover" : "xhs-card is-content",
						"rounded-[8px] bg-[#fbfaf7] text-[#111] [background-image:repeating-linear-gradient(transparent,transparent_13px,#dedbd1_14px)]",
					)}
					{...previewAttrs}
				>
					<div className="absolute bottom-0 left-[16%] top-0 w-px bg-[#ef4444]/35" />
					{variant === "cover" ? (
						<div className="xhs-memo-cover flex h-full items-center justify-center p-[12%]">
							<div className="xhs-memo-body -rotate-2 border-2 border-black bg-white p-[10%] shadow-[4px_4px_0_#111]">
								<p className="q-line mb-[10%] text-[1.35em] font-black leading-[1.2]">
									把复杂问题
									<br />
									<span className="hl bg-[#ffe45e] px-[2%]">拆成卡片</span>
								</p>
								<div className="flex gap-[4%]">
									<span className="xhs-s-token bg-black px-[5%] py-[3%] font-black text-white">
										效率翻倍
									</span>
									<span className="xhs-s-bill border border-black px-[5%] py-[3%]">
										收藏必看
									</span>
								</div>
								<span className="xhs-author mt-[10%] block text-right font-bold">
									@超级麦吉
								</span>
							</div>
						</div>
					) : (
						<div className="flex h-full flex-col justify-center p-[12%]">
							<div className="mb-[8%] w-max border-2 border-black bg-[#ffe45e] px-[5%] py-[3%] font-black">
								01
							</div>
							<p className="text-[1.45em] font-black leading-tight">
								先写结论，再补证据
							</p>
							<div className="mt-[10%] border-2 border-black bg-white p-[8%] shadow-[3px_3px_0_#111]">
								真实卡片会带有硬边框、手账线、贴纸式强调。
							</div>
						</div>
					)}
				</div>
			)
		case "code-dispatch":
			return (
				<div
					className={`${baseCardClass} preview-card-wrapper font-mono ${
						variant === "cover" ? "bg-light bg-white" : "bg-neutral bg-[#f2f2f2]"
					} [background-image:linear-gradient(#e0e0e0_1px,transparent_1px),linear-gradient(90deg,#e0e0e0_1px,transparent_1px)] [background-size:22px_22px]`}

					{...previewAttrs}
				>
					<div className="cd-header absolute inset-x-0 top-0 z-10 flex h-[14%] items-center justify-between bg-black px-[7%] text-white">
						<span className="cd-header-brand text-[0.85em] font-black tracking-[0.18em]">
							CODE DISPATCH
						</span>
						<span className="cd-header-meta text-[0.72em] tracking-[0.12em] text-zinc-300">
							{variant === "cover" ? "VOL.07 / 2024" : "02 / 05"}
						</span>
					</div>
					{variant === "cover" ? (
						<div className="cd-body is-cover absolute inset-x-0 bottom-[14%] top-[14%] px-[8%] py-[11%]">
							<div className="cd-eyebrow mb-[7%] flex items-center gap-[4%] text-[0.82em] font-black tracking-[0.12em]">
								<span className="cd-eyebrow-dot h-[0.85em] w-[0.85em] bg-[#dd0000]" />
								<span className="cd-eyebrow-text">DEEP DIVE</span>
							</div>
							<h1 className="cd-display text-[2.45em] font-black leading-[0.95]">
								Harness
								<br />
								Engi<span className="accent text-[#dd0000]">neer</span>ing
							</h1>
							<p className="cd-subtitle mt-[8%] border-l-2 border-[#dd0000] pl-[5%] text-[0.95em] font-semibold leading-[1.45]">
								模型只是大脑，真正让 AI 进入真实世界工作的是 Harness。
							</p>
							<div className="cd-tags mt-[8%] flex flex-wrap gap-[3%] text-[0.68em] font-black">
								<span className="cd-tag border border-black bg-white px-[5%] py-[3%]">
									AI AGENT
								</span>
								<span className="cd-tag border border-black bg-white px-[5%] py-[3%]">
									INFRA
								</span>
								<span className="cd-tag red bg-[#dd0000] px-[5%] py-[3%] text-white">
									HOT
								</span>
							</div>
						</div>
					) : (
						<div className="cd-body is-content absolute inset-x-0 bottom-[14%] top-[14%] px-[8%] py-[8%]">
							<div className="cd-section-label flex items-center gap-[5%]">
								<span className="cd-section-num bg-black px-[5%] py-[3%] font-black text-white">
									01
								</span>
								<span className="cd-section-title font-black">
									什么是 Harness？
								</span>
							</div>
							<div className="cd-rule my-[7%] h-px bg-black" />
							<div className="cd-know-card border-2 border-black bg-white p-[7%] shadow-[4px_4px_0_#dd0000]">
								<span className="cd-know-card-label text-[0.72em] font-black text-[#dd0000]">
									DEFINITION
								</span>
								<h3 className="cd-know-card-title mt-[4%] text-[1.14em] font-black leading-[1.18]">
									Harness 是包裹在模型外面的基础设施
								</h3>
								<p className="cd-know-card-body mt-[5%] text-[0.86em] leading-[1.45] text-zinc-700">
									工具注册表、上下文管理、错误恢复、状态追踪共同决定 Agent
									能否可靠工作。
								</p>
							</div>
						</div>
					)}
					<div className="cd-footer absolute inset-x-0 bottom-0 flex h-[14%] items-center justify-between border-t border-black bg-white px-[7%] font-mono text-[0.72em]">
						<span className="cd-footer-left cd-footer-status flex items-center gap-[0.45em] text-zinc-500">
							<span className="cd-status-dot h-[0.65em] w-[0.65em] bg-[#dd0000]" />
							<span>LIVE</span>
						</span>
						<span className="cd-footer-right">@超级麦吉</span>
					</div>
				</div>
			)
		case "dark-tech":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "dt-card dt-cover" : "dt-card dt-content",
						"rounded-[10px] bg-[#07080d] text-white [background-image:linear-gradient(#24242d_1px,transparent_1px),linear-gradient(90deg,#24242d_1px,transparent_1px)] [background-size:20px_20px]",
					)}

					{...previewAttrs}
				>
					<div className="dt-top-bar absolute inset-x-0 top-0 h-[3%] bg-[#d4b07a]" />
					<div className="flex h-full flex-col justify-center p-[12%]">
						<span className="dt-label-row mb-[8%] w-max border border-[#d4b07a]/70 px-[5%] py-[3%] font-mono text-[#d4b07a]">
							SYSTEM NOTE
						</span>
						{variant === "cover" ? (
							<h3 className="dt-title text-[2em] font-black leading-tight">
								Dark Tech Stack
							</h3>
						) : (
							<div className="dt-metrics space-y-[6%]">
								{["Latency 12ms", "Reliability 98", "Error 0.2%"].map((item) => (
									<div
										key={item}
										className="dt-metric flex justify-between border border-[#d4b07a]/45 bg-white/[0.04] p-[6%]"
									>
										<span className="text-zinc-400">{item.split(" ")[0]}</span>
										<span className="font-black text-[#d4b07a]">
											{item.split(" ")[1]}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)
		case "gradient-editorial":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "ge-card ge-cover" : "ge-card ge-content gray-bg",
						"rounded-[10px] bg-gradient-to-br from-[#29235c] via-[#6d5dfc] to-[#ff8ec3] text-white",
					)}

					{...previewAttrs}
				>
					{variant === "cover" ? (
						<>
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.32),transparent_26%)]" />
							<div className="ge-brand absolute left-[9%] top-[8%] text-[0.8em] font-bold tracking-[0.22em]">
								SUPER MAGIC
							</div>
							<div className="absolute inset-x-[9%] bottom-[12%]">
								<h3 className="ge-cover-title text-[2.2em] font-black leading-[0.95]">
									Creative Systems
								</h3>
							</div>
						</>
					) : (
						<div className="ge-white-card bg-white/92 absolute inset-[10%] rounded-[10px] p-[9%] text-[#29235c] shadow-lg">
							<span className="font-black tracking-[0.18em] text-[#ff5ea8]">
								03 SIGNALS
							</span>
							<div className="mt-[10%] space-y-[7%]">
								<div className="h-[0.8em] bg-[#29235c]" />
								<div className="h-[0.8em] w-[78%] bg-[#6d5dfc]" />
								<div className="h-[0.8em] w-[58%] bg-[#ff8ec3]" />
							</div>
						</div>
					)}
				</div>
			)
		case "personal-insight":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "pi-card pi-cover" : "pi-card pi-content",
						"rounded-[12px] bg-white p-[10%] text-[#171717]",
					)}

					{...previewAttrs}
				>
					<div className="pi-profile flex items-center gap-[6%]">
						<div className="pi-avatar flex size-[18%] items-center justify-center rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] font-black text-white">
							麦
						</div>
						<div className="pi-avatar-info flex flex-col gap-[0.3em]">
							<span className="pi-author font-black">超级麦吉</span>
							<span className="pi-date text-zinc-500">05/19</span>
						</div>
					</div>
					{variant === "cover" ? (
						<>
							<h3 className="pi-cover-title mt-[18%] text-[1.75em] font-black leading-tight">
								Harness Engineering：让 AI Agent 真正能用
							</h3>
							<p className="pi-abstract mt-[8%] text-[1em] leading-snug text-zinc-600">
								个人笔记式卡片，用头像、摘要和温和强调建立信任。
							</p>
						</>
					) : (
						<div className="mt-[15%]">
							<span className="pi-num inline-flex size-[16%] items-center justify-center rounded-full bg-[#1a73e8] font-black text-white">
								1
							</span>
							<h3 className="pi-heading mt-[8%] text-[1.55em] font-black leading-tight">
								没有 Harness 的 Agent 会怎样？
							</h3>
							<div className="pi-keypoint warm mt-[9%] rounded-[8px] bg-[#fff1d6] p-[8%]">
								<span className="pi-keypoint-label font-black text-[#b45309]">
									KEY POINT
								</span>
								<p className="pi-keypoint-title mt-[4%] font-black">Agent 撒谎了</p>
							</div>
						</div>
					)}
				</div>
			)
		case "film-vintage":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "fv-card fv-cover" : "fv-card fv-content",
						"rounded-[9px] bg-[#11100d] text-[#f5e6c8]",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#f1d6a8_1px,transparent_1px)] [background-size:5px_5px]" />
					{variant === "cover" ? (
						<>
							<div className="fv-photo absolute left-[11%] top-[10%] h-[40%] w-[46%] -rotate-6 border-[0.9em] border-white bg-[#5f1d1b]" />
							<div className="absolute inset-x-[10%] bottom-[12%] z-[1]">
								<div className="fv-section-label mb-[8%] font-mono text-[#b91c1c]">
									FILM LOG
								</div>
								<div className="fv-caption text-[1.75em] font-black leading-tight">
									胶片摄影
									<br />
									入门笔记
								</div>
							</div>
						</>
					) : (
						<div className="fv-info-card absolute inset-[11%] border border-[#f5e6c8]/45 bg-black/30 p-[8%]">
							<div className="fv-section-label mb-[10%] font-mono text-[#b91c1c]">
								GEAR REVIEW
							</div>
							{["FILM Portra 400", "LENS 35mm f/2", "EXP 1/250s"].map((item) => (
								<div
									key={item}
									className="fv-info-row flex justify-between border-t border-[#f5e6c8]/25 py-[6%]"
								>
									<span className="text-[#b91c1c]">{item.split(" ")[0]}</span>
									<span>{item.split(" ").slice(1).join(" ")}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)
		case "warm-journal":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "wj-card wj-cover" : "wj-card wj-khaki-page",
						"rounded-[10px] bg-[#c5bba5] text-[#2c2418]",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-0 [background-image:radial-gradient(rgba(0,0,0,0.14)_1px,transparent_1px)] [background-size:8px_8px]" />
					{variant === "cover" ? (
						<>
							<div className="wj-tape absolute left-[10%] top-[10%] h-[12%] w-[36%] -rotate-3 bg-[#0a0a0a]" />
							<div className="wj-photo-card absolute bottom-[12%] right-[9%] h-[38%] w-[42%] rotate-6 bg-white p-[4%] shadow-sm">
								<div className="h-full w-full bg-[#8c7b68]" />
							</div>
							<div className="wj-text-band absolute left-[10%] top-[33%] max-w-[58%]">
								<div className="wj-hand text-[1.7em] font-black leading-tight">
									慢下来
									<br />
									写生活
								</div>
								<div className="wj-strip mt-[12%] h-[0.55em] w-[72%] bg-[#5c6b54]" />
							</div>
						</>
					) : (
						<div className="wj-note-panel bg-[#efe4cd]/86 absolute inset-[10%] flex flex-col rounded-[8px] p-[9%] shadow-[inset_0_0_0_1px_rgba(44,36,24,0.12)]">
							<div className="wj-note-label mb-[8%] w-max rounded-full bg-[#2c2418] px-[7%] py-[3%] font-black text-[#efe4cd]">
								LIFE NOTES
							</div>
							<h3 className="wj-note-title text-[1.45em] font-black leading-tight">
								一篇温暖笔记的三段节奏
							</h3>
							<div className="mt-[10%] space-y-[6%]">
								{[
									"先写今天看到的细节",
									"补一个真实感受",
									"最后给读者一个可做动作",
								].map((item, index) => (
									<div
										key={item}
										className="wj-list-item flex items-start gap-[5%] border-t border-[#2c2418]/20 pt-[5%]"
									>
										<span className="font-black text-[#5c6b54]">
											0{index + 1}
										</span>
										<span className="leading-[1.35]">{item}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)
		case "paper-column":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "em-card em-cover" : "em-card",
						"rounded-[9px] bg-[#f3f0e8] p-[9%] text-[#11110f] [background-image:radial-gradient(rgba(17,17,15,0.08)_1px,transparent_1px)] [background-size:4px_4px]",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-[6%] border border-[#11110f]/10" />
					{variant === "cover" ? (
						<div className="relative z-[1] flex h-full flex-col">
							<div className="flex justify-between border-b border-[#11110f]/20 pb-[6%] font-mono text-[0.68em] uppercase tracking-[0.14em] text-[#70685d]">
								<span>Column</span>
								<span>01</span>
							</div>
							<h3 className="mt-[12%] font-serif text-[2.1em] font-medium leading-[1.08] tracking-[0.02em]">
								雨后
								<br />
								花园
								<br />
								<span className="text-[#315d93]">观察笔记</span>
							</h3>
							<div className="mt-auto h-[26%] border border-[#11110f]/20 bg-[#d8e1ea]" />
						</div>
					) : (
						<div className="relative z-[1] flex h-full flex-col">
							<p className="font-mono text-[0.7em] uppercase tracking-[0.16em] text-[#70685d]">
								Page 02 / Essay
							</p>
							<div className="mt-[10%] border-l-[0.22em] border-[#315d93] pl-[7%] font-serif text-[1.35em] font-medium leading-[1.35]">
								一条慢路径，
								<br />
								比大草坪更会留住人。
							</div>
							<div className="mt-[10%] space-y-[5%]">
								{["Path", "Bench", "Plant"].map((item, index) => (
									<div
										key={item}
										className="grid grid-cols-[20%_1fr] border-t border-[#11110f]/20 pt-[5%]"
									>
										<span className="font-mono text-[#315d93]">0{index + 1}</span>
										<span className="font-serif text-[1.02em]">{item}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)
		case "signal-grid":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "sg-card sg-cover" : "sg-card",
						"rounded-[7px] bg-[#fafaf8] text-[#0a0a0a] [background-image:radial-gradient(rgba(10,10,10,0.11)_1px,transparent_1px)] [background-size:16px_16px]",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-x-0 top-0 h-[3%] bg-[#002fa7]" />
					{variant === "cover" ? (
						<div className="flex h-full flex-col p-[10%] pt-[16%]">
							<div className="flex justify-between font-mono text-[0.7em] uppercase tracking-[0.12em] text-[#002fa7]">
								<span>Signal</span>
								<span>Grid</span>
							</div>
							<h3 className="mt-[13%] text-[2.55em] font-extralight leading-[0.98]">
								7天
								<br />
								<span className="text-[#002fa7]">专注力</span>
								<br />
								实验
							</h3>
							<div className="mt-auto grid grid-cols-2 border-l border-t border-[#0a0a0a]">
								{["07", "42%", "90", "3x"].map((item) => (
									<div
										key={item}
										className="border-b border-r border-[#0a0a0a] p-[9%]"
									>
										<span className="text-[1.45em] font-extralight">{item}</span>
									</div>
								))}
							</div>
						</div>
					) : (
						<div className="flex h-full flex-col p-[10%] pt-[16%]">
							<p className="font-mono text-[0.7em] uppercase tracking-[0.12em] text-[#002fa7]">
								Matrix
							</p>
							<h3 className="mt-[8%] text-[1.65em] font-light leading-[1.08]">
								开始前检查三项
							</h3>
							<div className="mt-[12%] space-y-[7%]">
								{[
									["Phone", "92%"],
									["Sleep", "78%"],
									["Desk", "68%"],
								].map(([label, value]) => (
									<div
										key={label}
										className="grid grid-cols-[28%_1fr_18%] items-center gap-[6%]"
									>
										<span className="font-mono text-[0.68em] uppercase">{label}</span>
										<div className="h-[0.85em] bg-[#f0f0ee]">
											<div
												className="h-full bg-[#002fa7]"
												style={{ width: value }}
											/>
										</div>
										<span className="font-mono text-[0.68em]">{value}</span>
									</div>
								))}
							</div>
							<div className="mt-auto flex items-center justify-between border-t border-[#0a0a0a] pt-[8%] font-mono text-[0.68em] uppercase tracking-[0.1em] text-[#737373]">
								<span>Decision</span>
								<span>03</span>
							</div>
						</div>
					)}
				</div>
			)
		case "product-launch-preset":
			return (
				<div
					className={cn(
						baseCardClass,
						variant === "cover" ? "pl-card pl-cover" : "pl-card pl-content",
						"rounded-[9px] bg-white p-[10%] text-[#111]",
					)}

					{...previewAttrs}
				>
					<div className="pl-topbar absolute inset-x-0 top-0 h-[4%] bg-[#e63946]" />
					{variant === "cover" ? (
						<>
							<div className="pl-header mt-[8%] w-max rounded-[3px] bg-[#111] px-[6%] py-[3%] font-black text-white">
								LAUNCH
							</div>
							<h3 className="pl-title mt-[16%] text-[2em] font-black leading-[0.95]">
								New Product
								<br />
								Release
							</h3>
							<div className="pl-image mt-[14%] h-[30%] rounded-[6px] border border-[#ebebeb] bg-[#f5f5f7]" />
						</>
					) : (
						<div className="pl-checklist mt-[12%] space-y-[6%]">
							{["核心卖点", "适用人群", "上线动作"].map((item, index) => (
								<div
									key={item}
									className="flex items-center gap-[5%] border-b border-[#ebebeb] pb-[5%]"
								>
									<span className="rounded-full bg-[#e63946] px-[5%] py-[3%] font-black text-white">
										0{index + 1}
									</span>
									<span className="font-black">{item}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)
		case "custom":
			return (
				<div
					className={cn(
						baseCardClass,
						"custom-card rounded-[8px] bg-white p-[12%] text-zinc-900",
					)}

					{...previewAttrs}
				>
					<div className="absolute inset-[8%] rounded border border-zinc-900" />
					<div className="relative z-[1] flex h-full items-center justify-center">
						<div className="h-[35%] w-[58%] -rotate-6 rounded-sm border border-zinc-900 bg-primary" />
					</div>
				</div>
			)
		case "none":
		default:
			return (
				<div
					className={cn(
						baseCardClass,
						"none-card flex items-center justify-center rounded-[8px] bg-muted/50 text-muted-foreground/50",
					)}

					{...previewAttrs}
				>
					<div className="h-[32%] w-[32%] rounded-full border border-dashed border-current" />
				</div>
			)
	}
}
export function PresetThumbnail({ value }: { value: string }) {
	return <PresetRealCard value={value} compact />
}