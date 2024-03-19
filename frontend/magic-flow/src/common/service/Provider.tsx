import React from "react"
import { getDefaultService } from "."
import { ServiceContext } from "./Context"
import useJSONSchemaDesigner from "./hooks/useJSONSchemaDesigner"

type ServiceProviderProps = React.PropsWithChildren<{
	baseURL: string
}>

export const ServiceProvider = ({ baseURL, children }: ServiceProviderProps) => {
	const defaultService = getDefaultService(baseURL)

	const JSONSchemaDesignerService = useJSONSchemaDesigner({ request: defaultService })

	return (
		<ServiceContext.Provider
			value={{
				JSONSchemaDesignerService,
			}}
		>
			{children}
		</ServiceContext.Provider>
	)
}
