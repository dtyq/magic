import { NodeSchema } from "@dtyq/magic-flow/dist/MagicFlow"
import React, { createContext, useContext, ReactNode } from "react"
import { ComponentVersionMap } from "../../nodes"

interface CommercialContextProps {
	canReferenceNodeTypes: string[]
	getEnterpriseSchemaConfigMap: () => Record<string, NodeSchema>
	extraNodeInfos: any
	enterpriseNodeComponentVersionMap: Record<string, Record<string, ComponentVersionMap>>
	enterpriseNodeTypes: Record<string, string>
}

const CommercialContext = createContext<CommercialContextProps | undefined>(undefined)

interface CommercialProviderProps extends React.PropsWithChildren {
	extraData?: CommercialContextProps
}

export const CommercialProvider: React.FC<CommercialProviderProps> = ({ children, extraData }) => {
	return <CommercialContext.Provider value={extraData}>{children}</CommercialContext.Provider>
}

export const useCommercial = (): CommercialContextProps | undefined => {
	return useContext(CommercialContext)
}

export default CommercialProvider
