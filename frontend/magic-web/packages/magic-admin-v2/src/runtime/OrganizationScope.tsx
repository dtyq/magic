import { QueryClientProvider } from "@tanstack/react-query"
import { useState, type PropsWithChildren } from "react"
import { createQueryClient } from "./createQueryClient"

/** A fresh cache per organization prevents cross-organization data reuse. */
export function OrganizationScope({ children }: PropsWithChildren) {
	const [queryClient] = useState(createQueryClient)
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
