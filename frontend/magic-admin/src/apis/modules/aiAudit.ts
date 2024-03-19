import type { AiAuditRequest } from "../../types/aiAudit"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"
import type { HttpClient } from "../core/HttpClient"
import type { WithPageStatus } from "../../types/common"

export const generateAiAuditApi = (client: HttpClient) => {
	return {
		getAiAuditList(params: AiAuditRequest) {
			return client.get<WithPageStatus<AiAuditRequest>>(
				genRequestUrl(RequestUrl.getAiAuditList, {}, params),
			)
		},
		identifyRisk(id: string, riskReason?: string) {
			const body = riskReason
				? { risk_reason: riskReason, risk_level: 1, status: 1 }
				: undefined
			return client.put<AiAuditRequest>(genRequestUrl(RequestUrl.identifyRisk, { id }), body)
		},
		revokeRisk(id: string) {
			return client.delete<AiAuditRequest>(genRequestUrl(RequestUrl.identifyRisk, { id }))
		},
		getTopicRisk(id: string) {
			return client.get(genRequestUrl(RequestUrl.identifyRisk, { id }))
		},
	}
}
