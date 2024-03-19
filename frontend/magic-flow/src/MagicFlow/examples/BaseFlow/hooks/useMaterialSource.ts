import { MagicFlow } from '@/MagicFlow/types/flow'
import React, { useMemo, useState } from 'react'
import { mockFlowList } from '../mock/flowList'
import _ from 'lodash'
import { MaterialGroup } from '@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext'
import { mockToolSets } from '../mock/toolsets'

export default function useMaterialSource() {

    const [subFlowList, setSubFlowList] = useState([] as MagicFlow.Flow[])

    const [toolGroup, setToolGroups] = useState([] as MaterialGroup[])

    const subFlow = useMemo(() => {
        return {
            list: subFlowList,
            searchListFn: async (keyword: string) => {
                const list = await Promise.resolve(mockFlowList)
                // @ts-ignore
                setSubFlowList(_.cloneDeep(list))
            }
            
        }
    }, [subFlowList])

    const tools = useMemo(() => {
        return {
            groupList: toolGroup,
            searchListFn: async (keyword: string) => {
                // @ts-ignore
                const list = await Promise.resolve(mockToolSets.reduce((beforeToolSets, currentToolSet) => {
                    const materialGroup = {
                        groupName: currentToolSet.name,
                        desc: currentToolSet.description,
                        avatar: currentToolSet.icon,
                        isGroupNode: true,
                        id: currentToolSet.id,
                        children: currentToolSet?.tools?.map?.(tool => {
                            return {
                                groupName: "",
                                description: tool.description,
                                avatar: currentToolSet.icon,
                                isGroupNode: false,
                                name: tool.name,
                                detail: {
                                    id: tool.code,
                                    input: null,
                                    output: null
                                }
                            }
                        })
                    }
                    const result = [...beforeToolSets, materialGroup]
                    return result
                }, [] as MaterialGroup[]))
                // @ts-ignore
                setToolGroups(_.cloneDeep(list))
            }
        }
    }, [toolGroup])

  return {
    subFlow,
    tools
  }
}
