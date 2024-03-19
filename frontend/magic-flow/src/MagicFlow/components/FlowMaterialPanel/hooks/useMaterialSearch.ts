import { useMemoizedFn } from 'ahooks'
import { useState } from 'react'
import { TabObject } from '../constants'
import { AgentType, useMaterialSource } from '@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext'

type UseMaterialSearchProps = {
    tab: TabObject
}

export default function useMaterialSearch({ tab }:UseMaterialSearchProps) {


	const [keyword, setKeyword] = useState('')

    const { subFlow, tools, agent } = useMaterialSource()

    const [agentType, setAgentType] = useState(AgentType.Enterprise)

	const onSearchChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setKeyword(e.target.value)
        // 触发业务测传入的更新数据方法
        switch(tab) {
            case TabObject.Flow:
                subFlow?.searchListFn?.(e.target.value)
                break;
            case TabObject.Tools:
                tools?.searchListFn?.(e.target.value)
                break;
            case TabObject.Agent:
                agent?.searchListFn?.(agentType, e.target.value)
                break;
            default:
                break;  
        }
	})

	return {
		keyword,
		onSearchChange,
        setAgentType,
        agentType
	}
}
