import { memo } from "react"
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationPrevious,
	PaginationNext,
	PaginationEllipsis,
} from "@/components/shadcn-ui/pagination"

interface SharePaginationProps {
	currentPage: number
	totalPages: number
	onPageChange: (page: number) => void
}

function SharePagination({ currentPage, totalPages, onPageChange }: SharePaginationProps) {
	// 生成页码数组
	const getPageNumbers = () => {
		const pages: (number | "ellipsis")[] = []
		const maxVisible = 7 // 最多显示7个页码

		if (totalPages <= maxVisible) {
			// 总页数较少，全部显示
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i)
			}
		} else {
			// 总页数较多，使用省略号
			if (currentPage <= 3) {
				// 当前页靠前
				for (let i = 1; i <= 5; i++) {
					pages.push(i)
				}
				pages.push("ellipsis")
				pages.push(totalPages)
			} else if (currentPage >= totalPages - 2) {
				// 当前页靠后
				pages.push(1)
				pages.push("ellipsis")
				for (let i = totalPages - 4; i <= totalPages; i++) {
					pages.push(i)
				}
			} else {
				// 当前页在中间
				pages.push(1)
				pages.push("ellipsis")
				for (let i = currentPage - 1; i <= currentPage + 1; i++) {
					pages.push(i)
				}
				pages.push("ellipsis")
				pages.push(totalPages)
			}
		}

		return pages
	}

	if (totalPages <= 1) {
		return null
	}

	const pages = getPageNumbers()

	return (
		<Pagination className="my-4">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
						className={
							currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
						}
					/>
				</PaginationItem>

				{pages.map((page, index) => {
					if (page === "ellipsis") {
						return (
							<PaginationItem key={`ellipsis-${index}`}>
								<PaginationEllipsis />
							</PaginationItem>
						)
					}

					return (
						<PaginationItem key={page}>
							<PaginationLink
								onClick={() => onPageChange(page)}
								isActive={currentPage === page}
								className="cursor-pointer"
							>
								{page}
							</PaginationLink>
						</PaginationItem>
					)
				})}

				<PaginationItem>
					<PaginationNext
						onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
						className={
							currentPage === totalPages
								? "pointer-events-none opacity-50"
								: "cursor-pointer"
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	)
}

export default memo(SharePagination)
