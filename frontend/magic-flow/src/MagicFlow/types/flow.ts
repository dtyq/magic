import { Edge, Node as BaseNode } from "reactflow"
import { FlowDesignerEvents, FlowStatus } from "../constants"
import { BaseNodeType } from "../register/node"
import { WidgetValue } from "../examples/BaseFlow/common/Output"

/** 流程类型 */
export enum FlowType {
    /** 主流程 */
    Main= 1,
    /** 子流程 */
    Sub = 2
}

export namespace MagicFlow {

    // 单个节点数据结构
    export interface Node extends BaseNode {
        id: string
        node_id: string
        // node_type: BaseNodeType  // 改为自定义参数名称了，不一定为 node_type
        meta: { 
			position: { x: number, y: number } 
			[key: string] : any
		}
        name?: string
        next_nodes: string[]
        step: number
        params?: {
            branches?: Array<{
                branch_id: string
                next_nodes: string[]
                config?: Record<string, any>
                input?: WidgetValue['value']
                output?: WidgetValue['value']
            }>
            [key:string]: any
        }
		content?: {
			[key: string]: any
		}
		// 是否处于debug模式
		debug?: boolean
        
        // 前端生成
        index?: number
        output?: WidgetValue['value'] | null
        input?: WidgetValue['value'] | null
		children?: MagicFlow.Node[]
        // 节点版本号
        node_version: string
		[key: string]: any
    }


    // 单个流程数据结构
    export interface Flow {
        id?: string
        name: string
        description: string
        enabled: boolean
        edges: Edge[]
        nodes: Node[]
        modified_at?: string
        type: FlowType
		icon?: string
		[key: string]: any
    }


	export interface ParamsName {
		params: string
		nodeType: string
        nextNodes: string
	}


	export interface FlowEventListener {
		type: FlowDesignerEvents
		data: any
	}

}