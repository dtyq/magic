import type { WithPage } from "@/types/common"
import type { ModelAudit } from "@/types/modelAudit"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateModelAuditApi = (client: HttpClient) => {
	return {
		getModelAuditLogList(params: ModelAudit.ModelAuditLogParams) {
			return client.post<WithPage<ModelAudit.ModelAuditLogItem>>(
				RequestUrl.getModelAuditLogList,
				params,
			)
		},
	}
}
