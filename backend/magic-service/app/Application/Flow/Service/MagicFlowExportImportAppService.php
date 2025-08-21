<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Factory\MagicFlowFactory;
use App\Domain\Flow\Factory\MagicFlowToolSetFactory;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowToolSetDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;
use Hyperf\Contract\ConfigInterface;
use Throwable;

class MagicFlowExportImportAppService
{
    public function __construct(
        protected MagicFlowDomainService $magicFlowDomainService,
        protected MagicFlowToolSetDomainService $magicFlowToolSetDomainService,
        protected ConfigInterface $config
    ) {
    }

    /**
     * 导出助理流程
     * 递归导出流程相关的所有节点，包括子流程和工具流程.
     */
    public function exportFlow(FlowDataIsolation $dataIsolation, string $flowCode): array
    {
        // 获取主流程
        $mainFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $flowCode);
        if (! $mainFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $flowCode]);
        }

        // 确保是主流程
        if (! $mainFlow->getType()->isMain()) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.export.not_main_flow', ['label' => $flowCode]);
        }

        // 检查是否存在循环依赖
        if ($this->checkCircularDependency($dataIsolation, $flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.export.circular_dependency_detected');
        }

        // 准备导出数据结构
        $exportData = [
            'main_flow' => $mainFlow->toArray(),
            'sub_flows' => [],
            'tool_flows' => [],
            'tool_sets' => [],
        ];

        // 已处理的流程编码，防止重复处理
        $processedFlowCodes = [$flowCode];
        $processedToolSetIds = [];

        // 递归处理主流程中的子流程和工具
        $this->processFlowForExport($dataIsolation, $mainFlow, $exportData, $processedFlowCodes, $processedToolSetIds);

        return $exportData;
    }

    /**
     * 导入助理流程
     * 遇到重复的工具或流程会创建新实例，并通过名称区分.
     */
    public function importFlow(FlowDataIsolation $dataIsolation, array $importData, string $agentId = ''): MagicFlowEntity
    {
        // 导入主流程
        $mainFlowData = $importData['main_flow'] ?? null;
        if (! $mainFlowData) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.import.missing_main_flow');
        }

        // 存储新旧ID映射关系
        $idMapping = [
            'flows' => [], // 老ID => 新ID
            'tool_sets' => [], // 老ID => 新ID
            'nodes' => [], // 老ID => 新ID
        ];

        // 导入报告，记录创建、重命名和错误信息
        $importReport = [
            'created' => [],
            'renamed' => [],
            'errors' => [],
        ];

        // 1. 先导入工具集
        if (! empty($importData['tool_sets'])) {
            foreach ($importData['tool_sets'] as $toolSetId => $toolSetData) {
                try {
                    $newToolSetId = $this->importToolSet($dataIsolation, $toolSetData, $idMapping, $importReport);
                    $idMapping['tool_sets'][$toolSetId] = $newToolSetId;
                } catch (Throwable $e) {
                    $importReport['errors'][] = "导入工具集 {$toolSetData['name']} 失败: {$e->getMessage()}";
                }
            }
        }

        // 2. 导入工具流程
        if (! empty($importData['tool_flows'])) {
            foreach ($importData['tool_flows'] as $toolFlowId => $toolFlowData) {
                try {
                    $newFlowId = $this->importSingleFlow($dataIsolation, $toolFlowData, $idMapping, $importReport);
                    $idMapping['flows'][$toolFlowId] = $newFlowId;
                } catch (Throwable $e) {
                    $importReport['errors'][] = "导入工具流程 {$toolFlowData['name']} 失败: {$e->getMessage()}";
                }
            }
        }

        // 3. 导入子流程
        if (! empty($importData['sub_flows'])) {
            foreach ($importData['sub_flows'] as $subFlowId => $subFlowData) {
                try {
                    $newFlowId = $this->importSingleFlow($dataIsolation, $subFlowData, $idMapping, $importReport);
                    $idMapping['flows'][$subFlowId] = $newFlowId;
                } catch (Throwable $e) {
                    $importReport['errors'][] = "导入子流程 {$subFlowData['name']} 失败: {$e->getMessage()}";
                }
            }
        }

        // 4. 最后导入主流程，并关联到指定助理（如果提供了agentId）
        try {
            // 如果提供了agentId，设置到主流程数据中
            if (! empty($agentId)) {
                $mainFlowData['agent_id'] = $agentId;
            }

            $newMainFlowId = $this->importSingleFlow($dataIsolation, $mainFlowData, $idMapping, $importReport);
            $idMapping['flows'][$mainFlowData['code']] = $newMainFlowId;
        } catch (Throwable $e) {
            $importReport['errors'][] = "导入主流程 {$mainFlowData['name']} 失败: {$e->getMessage()}";
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.import.main_flow_failed', ['error' => $e->getMessage()]);
        }

        // 5. 获取并返回导入后的主流程实体
        $mainFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $newMainFlowId);
        if (! $mainFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.import.failed', ['label' => $newMainFlowId]);
        }
        // 关联流程与助理
        if (! empty($agentId)) {
            $this->associateFlowWithAgent($dataIsolation, $mainFlow->getCode(), $agentId);
        }
        return $mainFlow;
    }

    /**
     * 验证是否存在循环依赖
     * 使用深度优先搜索检测循环引用.
     */
    public function checkCircularDependency(FlowDataIsolation $dataIsolation, string $flowCode, array $visited = []): bool
    {
        // 如果当前流程已在访问路径中，说明形成了循环
        if (in_array($flowCode, $visited)) {
            return true; // 发现循环依赖
        }

        // 将当前流程添加到访问路径
        $visited[] = $flowCode;

        // 获取流程实体
        $flow = $this->magicFlowDomainService->getByCode($dataIsolation, $flowCode);
        if (! $flow) {
            return false; // 流程不存在，不构成循环
        }

        // 遍历所有节点检查依赖
        foreach ($flow->getNodes() as $node) {
            // 检查子流程节点
            if ($node->getNodeType() === NodeType::Sub->value) {
                $subFlowId = $node->getParams()['sub_flow_id'] ?? '';
                if ($subFlowId && $this->checkCircularDependency($dataIsolation, $subFlowId, $visited)) {
                    return true; // 子流程中存在循环依赖
                }
            }

            // 检查LLM节点中的工具引用
            if ($node->getNodeType() === NodeType::LLM->value || $node->getNodeType() === NodeType::Tool->value) {
                $params = $node->getParams();
                if (isset($params['option_tools']) && is_array($params['option_tools'])) {
                    foreach ($params['option_tools'] as $optionTool) {
                        $toolId = $optionTool['tool_id'] ?? '';
                        $toolSetId = $optionTool['tool_set_id'] ?? '';

                        // 内置工具跳过循环依赖检查
                        if ($toolId && ! $this->isBuiltInTool($toolId, $toolSetId) && $this->checkCircularDependency($dataIsolation, $toolId, $visited)) {
                            return true; // 工具引用中存在循环依赖
                        }
                    }
                }
            }
        }

        return false; // 没有检测到循环依赖
    }

    /**
     * 导出流程和助理信息
     * 包含流程的所有数据以及助理的基本信息.
     */
    public function exportFlowWithAgent(FlowDataIsolation $dataIsolation, string $flowCode, MagicAgentEntity $agent): array
    {
        // 获取流程数据
        $flowData = $this->exportFlow($dataIsolation, $flowCode);

        // 添加助理信息
        $agentData = [
            'id' => $agent->getId(),
            'name' => $agent->getAgentName(),
            'description' => $agent->getAgentDescription(),
            'flow_code' => $agent->getFlowCode(),
            'avatar' => $agent->getAgentAvatar(),
            'instruct' => $agent->getInstructs(),
            // 可以根据需要添加其他助理信息
        ];

        return [
            'agent' => $agentData,
            'flow' => $flowData,
            'export_time' => date('Y-m-d H:i:s'),
            'export_version' => '1.0.0',
        ];
    }

    /**
     * 导入流程和助理信息
     * 从导出的数据中创建新的流程和助理，并建立关联.
     */
    public function importFlowWithAgent(FlowDataIsolation $dataIsolation, array $importData): array
    {
        $agentData = $importData['agent'] ?? [];
        $flowData = $importData['flow'] ?? [];

        if (empty($flowData) || empty($agentData)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.import.missing_data');
        }

        // 1. 先导入流程
        $mainFlow = $this->importFlow($dataIsolation, $flowData);

        // 2. 创建新的助理并关联流程
        $agentDomainService = di(MagicAgentDomainService::class);

        $agentEntity = new MagicAgentEntity();
        $agentEntity->setId('');
        $agentEntity->setAgentName($agentData['name'] ?? ('导入的助理_' . date('YmdHis')));
        $agentEntity->setAgentDescription($agentData['description'] ?? '');
        $agentEntity->setAgentAvatar($agentData['avatar'] ?? '');
        $agentEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $agentEntity->setFlowCode($mainFlow->getCode());
        $agentEntity->setStatus(0);
        $agentEntity->setCreatedUid($dataIsolation->getCurrentUserId());

        try {
            $savedAgent = $agentDomainService->saveAgent($agentEntity);
            $agentDomainService->updateInstruct($dataIsolation->getCurrentOrganizationCode(), $savedAgent->getId(), $agentData['instruct'], $dataIsolation->getCurrentUserId(), false);
            return [
                'agent_id' => $savedAgent->getId(),
                'agent_name' => $savedAgent->getAgentName(),
                'flow_id' => $mainFlow->getCode(),
                'flow_name' => $mainFlow->getName(),
            ];
        } catch (Throwable $e) {
            // 如果创建助理失败，但流程已导入，仍返回流程信息
            return [
                'agent_id' => null,
                'agent_error' => $e->getMessage(),
                'flow_id' => $mainFlow->getCode(),
                'flow_name' => $mainFlow->getName(),
            ];
        }
    }

    /**
     * 导入单个流程
     * 生成新ID并检查名称重复.
     */
    private function importSingleFlow(FlowDataIsolation $dataIsolation, array $flowData, array &$idMapping, array &$importReport): string
    {
        // 记录原始名称和ID
        $originalName = $flowData['name'] ?? '';
        $originalCode = $flowData['code'] ?? '';

        // 生成新ID
        $flowData['code'] = Code::MagicFlow->gen();

        // 检查是否存在同名流程，如果存在则重命名
        $flowType = isset($flowData['type']) ? Type::from($flowData['type']) : Type::Main;
        $newName = $this->generateUniqueName($dataIsolation, $originalName, $flowType);
        if ($newName !== $originalName) {
            $flowData['name'] = $newName;
            $importReport['renamed'][] = "流程 '{$originalName}' 重命名为 '{$newName}'";
        }

        // 更新节点ID映射
        $this->updateNodeIdsMapping($flowData, $idMapping);

        // 处理工具集ID引用
        if (! empty($flowData['tool_set_id']) && $flowData['tool_set_id'] !== 'not_grouped') {
            $oldToolSetId = $flowData['tool_set_id'];
            $newToolSetId = $idMapping['tool_sets'][$oldToolSetId] ?? $oldToolSetId;
            $flowData['tool_set_id'] = $newToolSetId;
        }

        // 更新流程节点中的引用关系
        $this->updateFlowReferences($flowData, $idMapping);

        // 更新组织信息
        $flowData['organization_code'] = $dataIsolation->getCurrentOrganizationCode();

        // 保留agentId字段，如果存在的话
        $agentId = $flowData['agent_id'] ?? '';
        // 创建流程实体并保存
        $flowEntity = MagicFlowFactory::arrayToEntity($flowData);
        $flowEntity->setCreator($dataIsolation->getCurrentUserId());
        $flowEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        // 设置agentId（如果存在）
        if (! empty($agentId)) {
            $flowEntity->setAgentId($agentId);
        }

        // 确保设置为新建流程
        $flowEntity->setId(0); // 设置ID为0表示新建
        $flowEntity->setId(null);
        $savedFlow = $this->magicFlowDomainService->create($dataIsolation, $flowEntity);
        $importReport['created'][] = "创建流程: {$savedFlow->getName()} (ID: {$savedFlow->getCode()})";

        return $savedFlow->getCode();
    }

    /**
     * 导入工具集
     * 生成新ID并检查名称重复.
     */
    private function importToolSet(FlowDataIsolation $dataIsolation, array $toolSetData, array &$idMapping, array &$importReport): string
    {
        // 记录原始名称和ID
        $originalName = $toolSetData['name'] ?? '';
        $originalCode = $toolSetData['code'] ?? '';

        // 生成新ID
        $toolSetData['code'] = Code::MagicFlowToolSet->gen();

        // 检查是否存在同名工具集，如果存在则重命名
        $newName = $this->generateUniqueToolSetName($dataIsolation, $originalName);
        if ($newName !== $originalName) {
            $toolSetData['name'] = $newName;
            $importReport['renamed'][] = "工具集 '{$originalName}' 重命名为 '{$newName}'";
        }

        // 更新组织信息
        $toolSetData['organization_code'] = $dataIsolation->getCurrentOrganizationCode();
        $toolSetData['created_uid'] = $dataIsolation->getCurrentUserId();
        $toolSetData['updated_uid'] = $dataIsolation->getCurrentUserId();

        // 移除可能影响创建逻辑的字段
        unset($toolSetData['created_at'], $toolSetData['updated_at'], $toolSetData['id']);

        // 设置创建实体必要的字段
        $toolSetData['id'] = 0; // 确保设置为新建
        $toolSetData['created_at'] = new DateTime();
        $toolSetData['updated_at'] = new DateTime();

        // 使用工厂方法创建工具集实体
        $toolSetEntity = MagicFlowToolSetFactory::arrayToEntity($toolSetData);

        // 保存工具集
        $savedToolSet = $this->magicFlowToolSetDomainService->create($dataIsolation, $toolSetEntity);
        $importReport['created'][] = "创建工具集: {$savedToolSet->getName()} (ID: {$savedToolSet->getCode()})";

        // 记录新旧ID的映射关系
        $idMapping['tool_sets'][$originalCode] = $savedToolSet->getCode();

        return $savedToolSet->getCode();
    }

    /**
     * 生成唯一的流程名称
     * 当检测到同名流程时，添加(n)后缀
     */
    private function generateUniqueName(FlowDataIsolation $dataIsolation, string $name, Type $type): string
    {
        $newName = $name;
        $counter = 1;

        // 工具不用重名，因为工具集不一样
        if ($type === Type::Tools) {
            return $name;
        }
        // 检查是否存在同名流程
        while ($this->magicFlowDomainService->getByName($dataIsolation, $newName, $type)) {
            $newName = "{$name}__{$counter}";
            ++$counter;
        }

        return $newName;
    }

    /**
     * 生成唯一的工具集名称
     * 当检测到同名工具集时，添加(n)后缀
     */
    private function generateUniqueToolSetName(FlowDataIsolation $dataIsolation, string $name): string
    {
        $newName = $name;
        $counter = 1;

        // 使用查询对象检查是否存在同名工具集
        while (true) {
            $query = new MagicFlowToolSetQuery();
            $query->setName($newName);
            $result = $this->magicFlowToolSetDomainService->queries($dataIsolation, $query, new Page(1, 100));

            $exists = false;
            foreach ($result['list'] as $toolSet) {
                if ($toolSet->getName() === $newName) {
                    $exists = true;
                    break;
                }
            }

            if ($exists) {
                $newName = "{$name}({$counter})";
                ++$counter;
            } else {
                break;
            }
        }

        return $newName;
    }

    /**
     * 更新节点ID映射
     * 为所有节点生成新ID并维护映射关系.
     */
    private function updateNodeIdsMapping(array &$flowData, array &$idMapping): void
    {
        if (empty($flowData['nodes'])) {
            return;
        }

        foreach ($flowData['nodes'] as &$nodeData) {
            $oldNodeId = $nodeData['node_id'] ?? '';
            if (! $oldNodeId) {
                continue;
            }

            // 生成新的节点ID
            $newNodeId = IdGenerator::getUniqueId32();
            $idMapping['nodes'][$oldNodeId] = $newNodeId;
            $nodeData['node_id'] = $newNodeId;
        }
    }

    /**
     * 更新流程中的引用关系
     * 包括节点引用、子流程引用、工具引用等.
     */
    private function updateFlowReferences(array &$flowData, array $idMapping): void
    {
        if (empty($flowData['nodes'])) {
            return;
        }

        foreach ($flowData['nodes'] as &$nodeData) {
            $nodeType = $nodeData['node_type'] ?? 0;

            // 更新节点参数中的引用
            if (! empty($nodeData['params'])) {
                // 子流程节点
                if ($nodeType === NodeType::Sub->value) {
                    // 更新子流程引用
                    if (isset($nodeData['params']['sub_flow_id'])) {
                        $oldSubFlowId = $nodeData['params']['sub_flow_id'];
                        $nodeData['params']['sub_flow_id'] = $idMapping['flows'][$oldSubFlowId] ?? $oldSubFlowId;
                    }
                }

                // 处理类型26的工具节点直接引用
                if ($nodeType === NodeType::Tool->value) {
                    if (isset($nodeData['params']['tool_id'])) {
                        $oldToolId = $nodeData['params']['tool_id'];
                        $newToolId = $idMapping['flows'][$oldToolId] ?? $oldToolId;
                        $nodeData['params']['tool_id'] = $newToolId;
                    }
                }

                // 工具节点或LLM节点
                if ($nodeType === NodeType::Tool->value || $nodeType === NodeType::LLM->value) {
                    // 更新工具引用
                    if (isset($nodeData['params']['option_tools']) && is_array($nodeData['params']['option_tools'])) {
                        foreach ($nodeData['params']['option_tools'] as &$optionTool) {
                            if (isset($optionTool['tool_id'])) {
                                $oldToolId = $optionTool['tool_id'];
                                $optionTool['tool_id'] = $idMapping['flows'][$oldToolId] ?? $oldToolId;
                            }
                            if (isset($optionTool['tool_set_id']) && $optionTool['tool_set_id'] !== 'not_grouped') {
                                $oldToolSetId = $optionTool['tool_set_id'];
                                $optionTool['tool_set_id'] = $idMapping['tool_sets'][$oldToolSetId] ?? $oldToolSetId;
                            }
                        }
                    }
                }

                // 处理参数中的表达式
                $this->updateExpressionReferences($nodeData['params'], $idMapping);
            }

            // 通用处理 input 字段 (如果存在且为数组)
            if (isset($nodeData['input']) && is_array($nodeData['input'])) {
                $this->processSpecialNodeFieldValue($nodeData['input'], $idMapping);
            }

            // 通用处理 output 字段 (如果存在且为数组)
            if (isset($nodeData['output']) && is_array($nodeData['output'])) {
                $this->processSpecialNodeFieldValue($nodeData['output'], $idMapping);
            }

            // 更新前置节点引用
            if (isset($nodeData['prev_nodes']) && is_array($nodeData['prev_nodes'])) {
                $prevNodes = [];
                foreach ($nodeData['prev_nodes'] as $prevNodeId) {
                    $newPrevNodeId = $idMapping['nodes'][$prevNodeId] ?? $prevNodeId;
                    $prevNodes[] = $newPrevNodeId;
                }
                $nodeData['prev_nodes'] = $prevNodes;
            }

            // 更新后续节点引用
            if (isset($nodeData['next_nodes']) && is_array($nodeData['next_nodes'])) {
                $nextNodes = [];
                foreach ($nodeData['next_nodes'] as $nextNodeId) {
                    $newNextNodeId = $idMapping['nodes'][$nextNodeId] ?? $nextNodeId;
                    $nextNodes[] = $newNextNodeId;
                }
                $nodeData['next_nodes'] = $nextNodes;
            }
        }

        // 处理edges中的source和target引用
        if (isset($flowData['edges']) && is_array($flowData['edges'])) {
            foreach ($flowData['edges'] as &$edge) {
                // 更新source引用
                if (isset($edge['source'])) {
                    $oldSourceId = $edge['source'];
                    $newSourceId = $idMapping['nodes'][$oldSourceId] ?? $oldSourceId;
                    $edge['source'] = $newSourceId;
                }

                // 更新target引用
                if (isset($edge['target'])) {
                    $oldTargetId = $edge['target'];
                    $newTargetId = $idMapping['nodes'][$oldTargetId] ?? $oldTargetId;
                    $edge['target'] = $newTargetId;
                }

                // 更新sourceHandle中可能包含的节点ID引用
                if (isset($edge['sourceHandle']) && is_string($edge['sourceHandle'])) {
                    foreach ($idMapping['nodes'] as $oldId => $newId) {
                        // 确保oldId是字符串类型
                        $oldIdStr = (string) $oldId;
                        $newIdStr = (string) $newId;

                        // 使用正则表达式确保只替换完整的ID
                        if (preg_match('/^' . preg_quote($oldIdStr, '/') . '_/', $edge['sourceHandle'])) {
                            $edge['sourceHandle'] = preg_replace('/^' . preg_quote($oldIdStr, '/') . '/', $newIdStr, $edge['sourceHandle']);
                        }
                    }
                }

                // 更新edge的ID（如果有）
                if (isset($edge['id'])) {
                    $edge['id'] = IdGenerator::getUniqueId32();
                }
            }
        }
    }

    /**
     * 递归处理数组中的表达式引用
     * 查找并更新所有包含节点ID的表达式字段.
     */
    private function updateExpressionReferences(array &$data, array $idMapping): void
    {
        foreach ($data as &$item) {
            if (is_array($item)) {
                // 递归处理嵌套数组
                $this->updateExpressionReferences($item, $idMapping);
            } elseif (is_string($item)) {
                // 跳过指令引用（instructions.*）
                if (strpos($item, 'instructions.') === 0) {
                    continue;
                }

                // 检查是否包含节点ID引用（格式如：nodeId.fieldName）
                foreach ($idMapping['nodes'] as $oldNodeId => $newNodeId) {
                    // 确保ID是字符串类型
                    $oldNodeIdStr = (string) $oldNodeId;
                    $newNodeIdStr = (string) $newNodeId;

                    // 使用正则表达式确保只替换完整的节点ID
                    if (preg_match('/^' . preg_quote($oldNodeIdStr, '/') . '\./', $item)) {
                        $fieldName = substr($item, strlen($oldNodeIdStr));
                        $item = $newNodeIdStr . $fieldName;
                        break; // 找到匹配后退出循环
                    }
                }
            }
        }

        // 处理对象形式的表达式值（如form结构中的field）
        if (isset($data['field'])) {
            $field = $data['field'];
            if (is_string($field)) {
                // 跳过指令引用
                if (strpos($field, 'instructions.') === 0) {
                    return;
                }

                // 检查是否包含节点ID引用
                foreach ($idMapping['nodes'] as $oldNodeId => $newNodeId) {
                    $oldNodeIdStr = (string) $oldNodeId;
                    $newNodeIdStr = (string) $newNodeId;

                    if (preg_match('/^' . preg_quote($oldNodeIdStr, '/') . '\./', $field)) {
                        $fieldName = substr($field, strlen($oldNodeIdStr));
                        $data['field'] = $newNodeIdStr . $fieldName;
                        break;
                    }
                }
            }
        }
    }

    /**
     * 判断是否为内置工具
     * 内置工具不需要重新创建，可以直接使用.
     */
    private function isBuiltInTool(string $toolId, string $toolSetId): bool
    {
        // 常见的内置工具集前缀
        $builtInToolSetPrefixes = [
            'file_box',      // 文件盒工具集
            'search_engine', // 搜索引擎工具集
            'web_browse',    // 网页浏览工具集
            'system',        // 系统工具集
            'knowledge',     // 知识库工具集
        ];

        // 判断是否属于内置工具集
        foreach ($builtInToolSetPrefixes as $prefix) {
            if ($toolSetId === $prefix || strpos($toolSetId, $prefix . '_') === 0) {
                return true;
            }
        }

        // 判断工具ID是否以工具集ID开头，这是内置工具的常见模式
        if (! empty($toolSetId) && strpos($toolId, $toolSetId . '_') === 0) {
            return true;
        }

        // 获取配置中的内置工具列表（如果有）
        $builtInTools = $this->config->get('flow.built_in_tools', []);
        if (in_array($toolId, $builtInTools)) {
            return true;
        }

        return false;
    }

    /**
     * 关联流程与助理
     * 在导入流程后将其与指定的助理关联.
     */
    private function associateFlowWithAgent(FlowDataIsolation $dataIsolation, string $flowCode, string $agentId): void
    {
        if (empty($agentId) || empty($flowCode)) {
            return;
        }

        $agentDomainService = di(MagicAgentDomainService::class);
        // 设置流程代码并保存助理
        $agentDomainService->associateFlowWithAgent($agentId, $flowCode);
    }

    /**
     * 处理特殊的表达式值字段.
     */
    private function processSpecialNodeFieldValue(array &$value, array $idMapping): void
    {
        foreach ($value as $key => &$item) {
            if (is_array($item)) {
                // 递归处理嵌套数组
                $this->processSpecialNodeFieldValue($item, $idMapping);
            } elseif (is_string($item)) {
                // 处理字符串中的节点ID引用
                $this->updateStringNodeReference($item, $idMapping);
            }
        }

        // 特殊处理const_value数组中的对象
        if (isset($value['const_value']) && is_array($value['const_value'])) {
            foreach ($value['const_value'] as &$constItem) {
                if (is_array($constItem)) {
                    // 处理对象形式的const_value项
                    if (isset($constItem['value']) && is_string($constItem['value'])) {
                        $this->updateStringNodeReference($constItem['value'], $idMapping);
                    }
                    // 递归处理其他字段
                    $this->processSpecialNodeFieldValue($constItem, $idMapping);
                } elseif (is_string($constItem)) {
                    // 处理字符串形式的const_value项
                    $this->updateStringNodeReference($constItem, $idMapping);
                }
            }
        }

        // 处理expression_value中的引用
        if (isset($value['expression_value']) && is_array($value['expression_value'])) {
            $this->processExpressionValue($value['expression_value'], $idMapping);
        }
    }

    /**
     * 更新字符串中的节点ID引用.
     */
    private function updateStringNodeReference(string &$str, array $idMapping): void
    {
        // 跳过指令引用（instructions.*）
        if (strpos($str, 'instructions.') === 0) {
            return;
        }

        // 检查是否包含节点ID引用（格式如：nodeId.fieldName）
        foreach ($idMapping['nodes'] as $oldNodeId => $newNodeId) {
            $oldNodeIdStr = (string) $oldNodeId;
            $newNodeIdStr = (string) $newNodeId;

            // 使用正则表达式确保只替换完整的节点ID
            if (preg_match('/^' . preg_quote($oldNodeIdStr, '/') . '\./', $str)) {
                $fieldName = substr($str, strlen($oldNodeIdStr));
                $str = $newNodeIdStr . $fieldName;
                break; // 找到匹配后退出循环
            }
        }
    }

    /**
     * 处理表达式值中的节点引用.
     */
    private function processExpressionValue(array &$expressionValue, array $idMapping): void
    {
        foreach ($expressionValue as &$item) {
            if (is_array($item)) {
                // 递归处理嵌套数组
                $this->processExpressionValue($item, $idMapping);
            } elseif (is_string($item)) {
                // 处理字符串中的节点ID引用
                $this->updateStringNodeReference($item, $idMapping);
            }
        }

        // 处理对象形式的表达式值（如form结构中的field）
        if (isset($expressionValue['field'])) {
            $field = $expressionValue['field'];
            if (is_string($field)) {
                $this->updateStringNodeReference($field, $idMapping);
                $expressionValue['field'] = $field;
            }
        }

        // 处理嵌套的value字段
        if (isset($expressionValue['value']) && is_array($expressionValue['value'])) {
            $this->processExpressionValue($expressionValue['value'], $idMapping);
        }

        // 处理const_value类型的嵌套结构
        if (isset($expressionValue['const_value']) && is_array($expressionValue['const_value'])) {
            $this->processExpressionValue($expressionValue['const_value'], $idMapping);
        }

        // 处理expression_value类型的嵌套结构
        if (isset($expressionValue['expression_value']) && is_array($expressionValue['expression_value'])) {
            $this->processExpressionValue($expressionValue['expression_value'], $idMapping);
        }

        // 处理form结构中的field数组
        if (isset($expressionValue['form']) && is_array($expressionValue['form'])) {
            foreach ($expressionValue['form'] as &$formItem) {
                if (isset($formItem['field']) && is_string($formItem['field'])) {
                    $this->updateStringNodeReference($formItem['field'], $idMapping);
                }

                // 递归处理formItem中的其他可能字段
                if (is_array($formItem)) {
                    $this->updateExpressionReferences($formItem, $idMapping);
                }
            }
        }
    }

    /**
     * 递归处理流程中的子流程和工具引用.
     */
    private function processFlowForExport(
        FlowDataIsolation $dataIsolation,
        MagicFlowEntity $flow,
        array &$exportData,
        array &$processedFlowCodes,
        array &$processedToolSetIds
    ): void {
        // 1. 处理工具集
        $this->processToolSet($dataIsolation, $flow, $exportData, $processedToolSetIds);

        // 2. 处理子流程节点
        $this->processSubFlowNodes($dataIsolation, $flow, $exportData, $processedFlowCodes, $processedToolSetIds);

        // 3. 处理工具节点
        $this->processToolNodes($dataIsolation, $flow, $exportData, $processedFlowCodes, $processedToolSetIds);
    }

    /**
     * 处理工具集.
     */
    private function processToolSet(
        FlowDataIsolation $dataIsolation,
        MagicFlowEntity $flow,
        array &$exportData,
        array &$processedToolSetIds
    ): void {
        $toolSetId = $flow->getToolSetId();
        // 跳过官方工具(not_grouped)和已处理的工具集
        if (empty($toolSetId) || $toolSetId === 'not_grouped' || in_array($toolSetId, $processedToolSetIds)) {
            return;
        }

        // 获取工具集信息
        $toolSet = $this->magicFlowToolSetDomainService->getByCode($dataIsolation, $toolSetId);
        // 标记为已处理
        $processedToolSetIds[] = $toolSetId;

        // 添加到导出数据中
        $exportData['tool_sets'][$toolSetId] = $toolSet->toArray();
    }

    /**
     * 处理子流程节点.
     */
    private function processSubFlowNodes(
        FlowDataIsolation $dataIsolation,
        MagicFlowEntity $flow,
        array &$exportData,
        array &$processedFlowCodes,
        array &$processedToolSetIds
    ): void {
        foreach ($flow->getNodes() as $node) {
            // 如果是子流程节点
            if ($node->getNodeType() === NodeType::Sub->value) {
                $subFlowId = $node->getParams()['sub_flow_id'] ?? '';
                // 跳过空ID和已处理的子流程
                if (! $subFlowId || in_array($subFlowId, $processedFlowCodes)) {
                    continue;
                }

                // 获取子流程
                $subFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $subFlowId);
                if (! $subFlow || $subFlow->getType() !== Type::Sub) {
                    // 子流程不存在或类型不正确，跳过但不报错
                    continue;
                }

                // 标记为已处理
                $processedFlowCodes[] = $subFlowId;

                // 添加到导出数据中
                $exportData['sub_flows'][$subFlowId] = $subFlow->toArray();

                // 递归处理子流程中的子流程和工具
                $this->processFlowForExport($dataIsolation, $subFlow, $exportData, $processedFlowCodes, $processedToolSetIds);
            }
        }
    }

    /**
     * 处理工具节点和LLM节点中的option_tools.
     */
    private function processToolNodes(
        FlowDataIsolation $dataIsolation,
        MagicFlowEntity $flow,
        array &$exportData,
        array &$processedFlowCodes,
        array &$processedToolSetIds
    ): void {
        foreach ($flow->getNodes() as $node) {
            // 处理节点类型26（直接在params中有tool_id的工具节点）
            if ($node->getNodeType() === NodeType::Tool->value) {
                $params = $node->getParams();
                $toolId = $params['tool_id'] ?? '';

                if (! $toolId || in_array($toolId, $processedFlowCodes)) {
                    continue;
                }

                // 获取工具流程
                $toolFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $toolId);
                if (! $toolFlow) {
                    continue;
                }

                // 标记为已处理
                $processedFlowCodes[] = $toolId;

                // 添加到导出数据中
                $exportData['tool_flows'][$toolId] = $toolFlow->toArray();

                // 递归处理
                $this->processFlowForExport($dataIsolation, $toolFlow, $exportData, $processedFlowCodes, $processedToolSetIds);
            }

            // 主要检查LLM和Tool节点
            if ($node->getNodeType() === NodeType::LLM->value || $node->getNodeType() === NodeType::Tool->value) {
                $params = $node->getParams();
                if (isset($params['option_tools']) && is_array($params['option_tools'])) {
                    foreach ($params['option_tools'] as $optionToolData) {
                        $toolId = $optionToolData['tool_id'] ?? '';
                        $toolSetId = $optionToolData['tool_set_id'] ?? '';

                        // 判断是否为内置工具，内置工具直接跳过
                        if ($this->isBuiltInTool($toolId, $toolSetId)) {
                            continue;
                        }

                        // 处理工具集引用
                        if (! empty($toolSetId) && $toolSetId !== 'not_grouped' && ! in_array($toolSetId, $processedToolSetIds)) {
                            $toolSet = $this->magicFlowToolSetDomainService->getByCode($dataIsolation, $toolSetId);
                            $processedToolSetIds[] = $toolSetId;
                            $exportData['tool_sets'][$toolSetId] = $toolSet->toArray();
                        }

                        // 处理工具流程引用
                        if (! $toolId || in_array($toolId, $processedFlowCodes)) {
                            continue;
                        }

                        // 获取工具流程
                        $toolFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $toolId);
                        if (! $toolFlow || $toolFlow->getType() !== Type::Tools) {
                            // 工具流程不存在或类型不正确，跳过但不报错
                            continue;
                        }

                        // 标记为已处理
                        $processedFlowCodes[] = $toolId;

                        // 添加到导出数据中
                        $exportData['tool_flows'][$toolId] = $toolFlow->toArray();

                        // 递归处理工具流程中的子流程和其他工具
                        $this->processFlowForExport($dataIsolation, $toolFlow, $exportData, $processedFlowCodes, $processedToolSetIds);
                    }
                }
            }
        }
    }
}
