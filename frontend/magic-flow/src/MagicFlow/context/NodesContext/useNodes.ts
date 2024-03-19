import { useContext } from "react"
import { NodesActionContext, NodesContext, NodesStateContext } from "./Context"

export const useNodes = () => useContext(NodesContext) 

export const useNodesActions = () => useContext(NodesActionContext)

export const useNodesState = () => useContext(NodesStateContext)