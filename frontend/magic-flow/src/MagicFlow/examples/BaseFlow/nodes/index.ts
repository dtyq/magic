import { customNodeType } from "../constants";
import { BranchComponentVersionMap } from "./Branch";
import { LLMComponentVersionMap } from "./LLM";
import { LoopComponentVersionMap } from "./Loop";
import { StartComponentVersionMap } from "./Start";
import { SubComponentVersionMap } from "./SubFlow";
import { ToolsComponentVersionMap } from "./Tools";
import { VariableComponentVersionMap } from "./VariableSave";


export const nodeComponentVersionMap = {
    [customNodeType.Start]: StartComponentVersionMap,
    [customNodeType.Sub]: SubComponentVersionMap,
    [customNodeType.VariableSave]: VariableComponentVersionMap,
    [customNodeType.LLM]: LLMComponentVersionMap,
    [customNodeType.Tools]: ToolsComponentVersionMap,
    [customNodeType.Loop]: LoopComponentVersionMap,
    [customNodeType.If]: BranchComponentVersionMap,
}