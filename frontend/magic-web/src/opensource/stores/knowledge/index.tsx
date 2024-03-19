import type { WithPage } from "@/opensource/types/flow"
import type { Knowledge } from "@/opensource/types/knowledge"
import type { SWRResponse } from "swr"
import useSWR from "swr"
import { create } from "zustand"
import { KnowledgeApi } from "@/opensource/apis"

interface KnowledgeStore {
	knowledgeList: Knowledge.KnowledgeItem[]
	useKnowledgeList: (
		params: Knowledge.GetKnowledgeListParams,
	) => SWRResponse<WithPage<Knowledge.KnowledgeItem[]>>
	useKnowledgeDetail: (id: string) => SWRResponse<Knowledge.Detail>
	useFragmentList: (
		params: Knowledge.GetFragmentListParams,
	) => SWRResponse<WithPage<Knowledge.FragmentItem[]>>
}
export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
	knowledgeList: [],
	useKnowledgeList: ({ name, page, pageSize = 100 }: Knowledge.GetKnowledgeListParams) => {
		return useSWR(
			"/api/v1/knowledge-bases/queries",
			() =>
				KnowledgeApi.getKnowledgeList({
					name,
					page,
					pageSize,
				}),
			{
				onSuccess(d: WithPage<Knowledge.KnowledgeItem[]>) {
					if (d.list) {
						set(() => ({
							knowledgeList: d.list,
						}))
					}
				},
			},
		)
	},

	useKnowledgeDetail: (id: string) => {
		return useSWR(`${"/api/v1/knowledge-bases/${code}"}/${id}`, () =>
			KnowledgeApi.getKnowledgeDetail(id),
		)
	},

	useFragmentList: (params: Knowledge.GetFragmentListParams) => {
		return useSWR(
			`${"/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments/queries"}`,
			() => KnowledgeApi.getFragmentList(params),
		)
	},
}))
