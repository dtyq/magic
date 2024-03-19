import { useEffect, useRef, useState } from "react"
import type { CrewItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import CrewModeItem from "../CrewModeItem"

interface CrewGridProps {
	crews: CrewItem[]
	selectedCrew: string
	onSelectCrew: (crew: CrewItem) => void
}

export default function CrewGrid({ crews, selectedCrew, onSelectCrew }: CrewGridProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
	const [showBottomMask, setShowBottomMask] = useState(false)
	const [showTopMask, setShowTopMask] = useState(false)

	// 检查是否需要显示顶部和底部遮罩
	useEffect(() => {
		function checkScroll() {
			if (scrollContainerRef.current) {
				const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current
				const hasScroll = scrollHeight > clientHeight
				const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
				const isAtTop = scrollTop < 10

				setShowBottomMask(hasScroll && !isAtBottom)
				setShowTopMask(hasScroll && !isAtTop)
			}
		}

		checkScroll()
		const container = scrollContainerRef.current
		if (container) {
			container.addEventListener("scroll", checkScroll)
			window.addEventListener("resize", checkScroll)
		}

		return () => {
			if (container) {
				container.removeEventListener("scroll", checkScroll)
			}
			window.removeEventListener("resize", checkScroll)
		}
	}, [crews])

	// 当选中项变化时，自动滚动到居中位置
	useEffect(() => {
		if (selectedCrew && scrollContainerRef.current) {
			const selectedElement = itemRefs.current.get(selectedCrew)
			if (selectedElement) {
				const container = scrollContainerRef.current
				const containerRect = container.getBoundingClientRect()
				const elementRect = selectedElement.getBoundingClientRect()

				// 计算元素相对于容器的位置
				const elementTop = elementRect.top - containerRect.top + container.scrollTop
				const elementCenter = elementTop + elementRect.height / 2
				const containerCenter = container.clientHeight / 2

				// 滚动到使选中项居中
				container.scrollTo({
					top: elementCenter - containerCenter,
					behavior: "smooth",
				})
			}
		}
	}, [selectedCrew])

	function setItemRef(identifier: string, element: HTMLDivElement | null) {
		if (element) {
			itemRefs.current.set(identifier, element)
		} else {
			itemRefs.current.delete(identifier)
		}
	}

	return (
		<div className="relative max-h-full min-h-0 w-full">
			{/* 顶部渐变遮罩 */}
			{showTopMask && (
				<div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-20 bg-gradient-to-b from-sidebar to-transparent" />
			)}

			<div ref={scrollContainerRef} className="max-h-full overflow-y-auto px-5">
				<div className="grid w-full grid-cols-2 gap-2">
					{crews.map((crew) => (
						<div
							key={crew.mode.identifier}
							ref={(el) => setItemRef(crew.mode.identifier, el)}
						>
							<CrewModeItem
								crew={crew}
								isActive={selectedCrew === crew.mode.identifier}
								onClick={onSelectCrew}
							/>
						</div>
					))}
				</div>
			</div>

			{/* 底部渐变遮罩 */}
			{showBottomMask && (
				<div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-20 bg-gradient-to-t from-sidebar to-transparent" />
			)}
		</div>
	)
}
