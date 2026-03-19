import { useResponsive } from "ahooks"
import MagicSkeleton from "@/components/base/MagicSkeleton"

export default function AgentSettingsSkeleton() {
	const { md } = useResponsive()
	const isMobile = !md

	if (isMobile) {
		return (
			<div className="flex h-[76vh] w-full flex-col">
				<div className="flex h-[52px] w-full flex-none items-center justify-between p-2.5">
					<MagicSkeleton width={80} height={24} borderRadius={4} />
					<MagicSkeleton width={24} height={24} borderRadius={4} />
				</div>
				<div className="flex flex-1 flex-col gap-3 p-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="bg-magic-grey-0 flex items-center gap-3 rounded-lg p-3"
						>
							<MagicSkeleton width={40} height={40} borderRadius={8} />
							<div className="flex flex-1 flex-col gap-1.5">
								<MagicSkeleton width="60%" height={16} borderRadius={4} />
								<MagicSkeleton width="80%" height={12} borderRadius={4} />
							</div>
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="bg-magic-white-1 flex h-[600px] w-full items-start overflow-hidden rounded-xl">
			{/* 左侧面板骨架 */}
			<div className="bg-magic-grey-0 flex h-full w-[200px] flex-none flex-col gap-2.5 border-r border-border p-3.5">
				<MagicSkeleton width={60} height={12} borderRadius={4} />
				<div className="flex items-center gap-2 px-2.5 py-1.5">
					<MagicSkeleton width={16} height={16} borderRadius={4} />
					<MagicSkeleton width={80} height={14} borderRadius={4} />
				</div>
			</div>

			{/* 右侧内容骨架 */}
			<div className="flex h-full flex-auto flex-col gap-4 p-5">
				<div className="flex items-center justify-between">
					<MagicSkeleton width={120} height={24} borderRadius={4} />
					<MagicSkeleton width={80} height={32} borderRadius={6} />
				</div>

				<div className="flex flex-col gap-3">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="bg-magic-grey-0 flex items-center gap-3 rounded-lg p-3"
						>
							<MagicSkeleton width={48} height={48} borderRadius={8} />
							<div className="flex flex-1 flex-col gap-1.5">
								<MagicSkeleton width="40%" height={16} borderRadius={4} />
								<MagicSkeleton width="70%" height={12} borderRadius={4} />
							</div>
							<MagicSkeleton width={60} height={28} borderRadius={6} />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
