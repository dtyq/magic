import React, { useState, useCallback, useMemo } from "react"
import type { DetailData } from "../Detail/types"

interface DetailProviderProps {
	children: React.ReactNode
}

export const DetailContext = React.createContext<{
	detail: DetailData | undefined
	setDetail: (detail: DetailData | undefined) => void
}>({
	detail: undefined,
	setDetail: () => {},
})

export const useDetail = () => React.useContext(DetailContext)

const DetailProvider: React.FC<DetailProviderProps> = ({ children }) => {
	const [detail, setDetail] = useState<DetailData | undefined>(undefined)

	const memoizedDetail = useMemo(() => detail, [detail])

	const handleSetDetail = useCallback((newDetail: DetailData | undefined) => {
		setDetail(newDetail)
	}, [])

	const contextValue = useMemo(
		() => ({
			detail: memoizedDetail,
			setDetail: handleSetDetail,
		}),
		[memoizedDetail, handleSetDetail],
	)

	return <DetailContext.Provider value={contextValue}>{children}</DetailContext.Provider>
}

export default DetailProvider
