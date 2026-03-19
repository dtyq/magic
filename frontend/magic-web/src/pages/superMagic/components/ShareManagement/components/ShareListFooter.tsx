import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/shadcn-ui/pagination"
import { cn } from "@/lib/utils"

interface ShareListFooterProps {
	currentPage: number
	totalPages: number
	onPageChange: (page: number) => void
	className?: string
}

/**
 * 分页Footer组件
 * 匹配 Figma 设计：https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=573-18987
 */
function ShareListFooter({
	currentPage,
	totalPages,
	onPageChange,
	className,
}: ShareListFooterProps) {
	const { t } = useTranslation("super")
	const [isEditing, setIsEditing] = useState(false)
	const [inputValue, setInputValue] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)

	// 计算显示的页码
	const pageNumbers = useMemo(() => {
		const pages: (number | "ellipsis")[] = []

		if (totalPages <= 7) {
			// 总页数 <= 7，全部显示
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i)
			}
		} else {
			// 总页数 > 7，显示省略号
			if (currentPage <= 3) {
				// 当前页在前3页
				pages.push(1, 2, 3, "ellipsis", totalPages)
			} else if (currentPage >= totalPages - 2) {
				// 当前页在后3页
				pages.push(1, "ellipsis", totalPages - 2, totalPages - 1, totalPages)
			} else {
				// 当前页在中间
				pages.push(1, "ellipsis", currentPage, "ellipsis", totalPages)
			}
		}

		return pages
	}, [currentPage, totalPages])

	const handlePrevious = () => {
		if (currentPage > 1) {
			onPageChange(currentPage - 1)
		}
	}

	const handleNext = () => {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1)
		}
	}

	const handlePageClick = (page: number) => {
		onPageChange(page)
	}

	// 点击当前页时进入编辑模式
	const handleCurrentPageClick = useCallback(() => {
		setIsEditing(true)
		setInputValue(currentPage.toString())
	}, [currentPage])

	// 自动聚焦输入框
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	// 处理页码跳转
	const handlePageJump = useCallback(() => {
		const pageNum = parseInt(inputValue, 10)
		if (isNaN(pageNum)) {
			magicToast.error(t("shareManagement.invalidPageNumber"))
			setIsEditing(false)
			return
		}
		if (pageNum < 1 || pageNum > totalPages) {
			magicToast.error(t("shareManagement.pageOutOfRange", { min: 1, max: totalPages }))
			setIsEditing(false)
			return
		}
		if (pageNum !== currentPage) {
			onPageChange(pageNum)
		}
		setIsEditing(false)
	}, [inputValue, totalPages, currentPage, onPageChange, t])

	// 按键处理
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				handlePageJump()
			} else if (e.key === "Escape") {
				setIsEditing(false)
			}
		},
		[handlePageJump],
	)

	// 失去焦点时提交
	const handleBlur = useCallback(() => {
		if (isEditing) {
			handlePageJump()
		}
	}, [isEditing, handlePageJump])

	return (
		<div
			className={cn(
				"flex items-center justify-center border-t border-neutral-200 py-3",
				className,
			)}
		>
			<Pagination>
				<PaginationContent className="gap-1">
					{/* 上一页按钮 */}
					<PaginationItem>
						<PaginationPrevious
							onClick={handlePrevious}
							className={cn(
								"h-9 gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
								currentPage === 1
									? "pointer-events-none opacity-50"
									: "cursor-pointer hover:bg-neutral-100",
							)}
							style={{ color: "var(--base-foreground, #0A0A0A)" }}
						>
							<span>{t("shareManagement.previousPage")}</span>
						</PaginationPrevious>
					</PaginationItem>

					{/* 页码按钮 */}
					{pageNumbers.map((page, index) => {
						if (page === "ellipsis") {
							return (
								<PaginationItem key={`ellipsis-${index}`}>
									<PaginationEllipsis className="h-9 w-9" />
								</PaginationItem>
							)
						}

						const isActive = currentPage === page

						return (
							<PaginationItem key={page}>
								{isActive && isEditing ? (
									// 编辑模式：显示输入框
									<input
										ref={inputRef}
										type="text"
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										onKeyDown={handleKeyDown}
										onBlur={handleBlur}
										className={cn(
											"h-9 w-9 rounded-lg border border-neutral-200 bg-white text-center text-sm font-medium shadow-sm outline-none transition-colors",
											"focus:border-[#0A0A0A]",
										)}
										style={{
											color: "var(--base-foreground, #0A0A0A)",
										}}
									/>
								) : (
									// 显示模式：页码按钮
									<PaginationLink
										onClick={() =>
											isActive
												? handleCurrentPageClick()
												: handlePageClick(page)
										}
										isActive={isActive}
										className={cn(
											"h-9 w-9 cursor-pointer rounded-lg text-sm font-medium transition-colors",
											isActive
												? "border border-neutral-200 bg-white shadow-sm"
												: "bg-transparent hover:bg-neutral-100",
										)}
										style={{ color: "var(--base-foreground, #0A0A0A)" }}
									>
										{page}
									</PaginationLink>
								)}
							</PaginationItem>
						)
					})}

					{/* 下一页按钮 */}
					<PaginationItem>
						<PaginationNext
							onClick={handleNext}
							className={cn(
								"h-9 gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
								currentPage === totalPages
									? "pointer-events-none opacity-50"
									: "cursor-pointer hover:bg-neutral-100",
							)}
							style={{ color: "var(--base-foreground, #0A0A0A)" }}
						>
							<span>{t("shareManagement.nextPage")}</span>
						</PaginationNext>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	)
}

export default memo(ShareListFooter)
