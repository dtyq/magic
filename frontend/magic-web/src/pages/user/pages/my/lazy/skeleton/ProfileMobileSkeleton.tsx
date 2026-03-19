import { Skeleton } from "@/components/base/Skeleton"

/**
 * Profile 移动端骨架屏组件
 * 对应页面: src/pages/user/pages/my/index.tsx
 * 根据最新 UI 布局还原:
 * - 顶部区域: UserInfoHeader + PlanCard
 * - 主内容区:
 *   - ProfileActionEntry: profile action entry
 *   - AccountDetailsSection: 账户明细 (积分明细 + 消费订单)
 *   - AccountManagementSection: 账户管理 (个人信息 + 账户安全 + 登录设备)
 *   - SystemSettingsSection: 系统设置 (设置 + 关于我们 + 问题反馈)
 *   - LogoutButton: 退出登录按钮
 */
export default function ProfileMobileSkeleton() {
	return (
		<div className="relative h-full w-full bg-sidebar pt-safe-top">
			{/* 可滚动内容 */}
			<div className="h-full w-full overflow-y-auto bg-sidebar">
				{/* 顶部区域: UserInfoHeader + PlanCard */}
				<div className="flex w-full flex-col justify-end gap-3.5 p-3.5">
					{/* UserInfoHeader 骨架屏 - 扁平布局，无背景 */}
					<div className="flex w-full items-center justify-between gap-2">
						{/* 用户信息 */}
						<div className="flex w-full items-center gap-2">
							<Skeleton.Title
								animated
								style={{ width: 42, height: 42 }}
								className="flex-none rounded-lg"
							/>
							<div className="flex flex-1 flex-col gap-0">
								<Skeleton.Title animated style={{ width: 50, height: 12 }} />
								<Skeleton.Title animated style={{ width: 80, height: 23 }} />
							</div>
						</div>

						{/* 组织切换按钮 */}
						<Skeleton.Title
							animated
							style={{ width: 80, height: 32 }}
							className="rounded-lg"
						/>
					</div>

					{/* PlanCard 骨架屏 - rounded-full 黑色背景 */}
					<div className="flex w-full items-center justify-between gap-3 overflow-hidden rounded-full bg-foreground p-2 pl-4">
						{/* 左侧：图标 + 套餐名称 */}
						<div className="flex items-center gap-1.5">
							<Skeleton.Title
								animated
								style={{ width: 24, height: 24 }}
								className="flex-none rounded"
							/>
							<Skeleton.Title animated style={{ width: 60, height: 16 }} />
						</div>

						{/* 右侧：按钮 */}
						<Skeleton.Title
							animated
							style={{ width: 80, height: 28 }}
							className="rounded-full"
						/>
					</div>
				</div>

				{/* 主内容区 */}
				<div className="flex w-full flex-col gap-4 px-3.5 py-4">
					{/* 邀请好友模块 - 特殊渐变背景 */}
					<Skeleton.Title
						animated
						style={{ width: "100%", height: 56 }}
						className="rounded-lg"
					/>

					{/* 账户明细 Section */}
					<div className="flex flex-col gap-2">
						<div className="px-1">
							<Skeleton.Title animated style={{ width: 60, height: 16 }} />
						</div>
						<div className="overflow-hidden rounded-xl bg-fill">
							{Array.from({ length: 2 }).map((_, index) => (
								<div key={index} className="flex h-11 items-center gap-2 px-3 py-2">
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
									<Skeleton.Title
										animated
										style={{ width: 100, height: 20 }}
										className="flex-1"
									/>
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
								</div>
							))}
						</div>
					</div>

					{/* 账户管理 Section */}
					<div className="flex flex-col gap-2">
						<div className="px-1">
							<Skeleton.Title animated style={{ width: 60, height: 16 }} />
						</div>
						<div className="overflow-hidden rounded-xl bg-fill">
							{Array.from({ length: 3 }).map((_, index) => (
								<div key={index} className="flex h-11 items-center gap-2 px-3 py-2">
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
									<Skeleton.Title
										animated
										style={{ width: 100, height: 20 }}
										className="flex-1"
									/>
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
								</div>
							))}
						</div>
					</div>

					{/* 系统设置 Section */}
					<div className="flex flex-col gap-2">
						<div className="px-1">
							<Skeleton.Title animated style={{ width: 60, height: 16 }} />
						</div>
						<div className="overflow-hidden rounded-xl bg-fill">
							{Array.from({ length: 3 }).map((_, index) => (
								<div key={index} className="flex h-11 items-center gap-2 px-3 py-2">
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
									<Skeleton.Title
										animated
										style={{ width: 100, height: 20 }}
										className="flex-1"
									/>
									<Skeleton.Title
										animated
										style={{ width: 16, height: 16 }}
										className="flex-none"
									/>
								</div>
							))}
						</div>
					</div>

					{/* 退出登录按钮 - 单独的 MenuButton */}
					<div className="flex h-11 w-full items-center gap-2 rounded-xl bg-fill px-3 py-2">
						<Skeleton.Title
							animated
							style={{ width: 16, height: 16 }}
							className="flex-none"
						/>
						<Skeleton.Title
							animated
							style={{ width: 60, height: 20 }}
							className="flex-1"
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
