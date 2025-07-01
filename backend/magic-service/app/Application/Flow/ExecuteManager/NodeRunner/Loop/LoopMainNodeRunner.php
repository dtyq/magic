<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Loop;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionFlowCollector;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loop\LoopMainNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loop\LoopType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Throwable;

#[FlowNodeDefine(
    type: NodeType::LoopMain->value,
    code: NodeType::LoopMain->name,
    name: '循环 / 主循环',
    paramsConfig: LoopMainNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: false,
)]
class LoopMainNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $bodyId = $this->node->getMeta()['relation_id'] ?? '';
        if (empty($bodyId)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.relation_id_empty');
        }
        $magicFlow = ExecutionFlowCollector::getOrCreate($executionData->getUniqueId(), $executionData->getMagicFlowEntity());

        $loopFlow = $this->createLoopFlow($bodyId, $magicFlow);
        if (! $loopFlow) {
            return;
        }

        $breakVariableKey = "#{$bodyId}_break";
        // 采用变量来初始化跳出循环配置
        $executionData->variableSave($breakVariableKey, false);

        $params = $this->node->getParams();
        $type = LoopType::tryFrom($params['type'] ?? '');

        switch ($type) {
            case LoopType::Count:
                $countComponent = ComponentFactory::fastCreate($params['count'] ?? []);
                if (! $countComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.component.format_error', ['label' => 'count']);
                }
                $count = $countComponent->getValue()->getResult($executionData->getExpressionFieldData()) ?? 0;
                if (! is_numeric($count) || $count <= 0) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.count_format_error');
                }
                for ($i = 0; $i < $count; ++$i) {
                    $this->runLoopFlow($loopFlow, $executionData);
                    if ($executionData->variableGet($breakVariableKey, false)) {
                        break;
                    }
                }
                break;
            case LoopType::Array:
                $arrayComponent = ComponentFactory::fastCreate($params['array'] ?? []);
                if (! $arrayComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.component.format_error', ['label' => 'array']);
                }
                $array = $arrayComponent->getValue()->getResult($executionData->getExpressionFieldData()) ?? [];
                if (! is_array($array)) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.array_format_error');
                }
                foreach ($array as $index => $item) {
                    $executionData->saveNodeContext($this->node->getNodeId(), [
                        'item' => $item,
                        'index' => $index,
                    ]);
                    $this->runLoopFlow($loopFlow, $executionData);
                    if ($executionData->variableGet($breakVariableKey, false)) {
                        break;
                    }
                }
                break;
            case LoopType::Condition:
                $conditionComponent = ComponentFactory::fastCreate($params['condition'] ?? []);
                if (! $conditionComponent?->isCondition()) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.component.format_error', ['label' => 'condition']);
                }
                // 初始条件
                $condition = $conditionComponent->getCondition()->getResult($executionData->getExpressionFieldData()) ?? [];

                $maxLoopCountComponent = ComponentFactory::fastCreate($params['max_loop_count'] ?? []);
                if (! $maxLoopCountComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.component.format_error', ['label' => 'max_loop_count']);
                }
                $maxLoopCount = $maxLoopCountComponent->getValue()->getResult($executionData->getExpressionFieldData()) ?? 0;
                if (! is_numeric($maxLoopCount) || $maxLoopCount <= 0 || $maxLoopCount > 9999) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.max_loop_count_format_error', ['min' => 1, 'max' => 9999]);
                }
                $maxLoopCount = (int) $maxLoopCount;
                $loopCount = 0;
                while ($condition) {
                    $this->runLoopFlow($loopFlow, $executionData);
                    if ($executionData->variableGet($breakVariableKey, false)) {
                        break;
                    }
                    ++$loopCount;
                    if ($loopCount >= $maxLoopCount) {
                        break;
                    }
                    // 每次重新计算条件
                    $condition = $conditionComponent->getCondition()->getResult($executionData->getExpressionFieldData());
                }
                break;
            default:
                return;
        }
    }

    private function createLoopFlow(string $bodyId, MagicFlowEntity $magicFlow): ?MagicFlowEntity
    {
        $loopMagicFlow = clone $magicFlow;

        // 做区分
        $loopMagicFlow->setCode($magicFlow->getCode() . '_loop');
        $loopMagicFlow->setType(Type::Loop);

        // 循环体节点
        $bodyNode = $magicFlow->getNodeById($bodyId);
        if (! $bodyNode) {
            return null;
        }

        // 获取所有 父 id 是这个循环体的节点
        $childNodes = $magicFlow->getNodesByParentId($bodyId);
        if (empty($childNodes)) {
            return null;
        }
        // 去除父 id 属性，不然会被过滤
        foreach ($childNodes as $node) {
            $meta = $node->getMeta();
            $meta['parent_id'] = '';
            $node->setMeta($meta);
        }
        // 更换执行的节点
        $loopMagicFlow->setNodes($childNodes);

        return $loopMagicFlow;
    }

    private function runLoopFlow(MagicFlowEntity $loopMagicFlow, ExecutionData $executionData): void
    {
        try {
            $subExecutor = new MagicFlowExecutor($loopMagicFlow, $executionData);
            $subExecutor->setInLoop(true);
            // 复用当前的执行数据，循环体内可访问和修改
            $subExecutor->execute(TriggerType::LoopStart);
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.loop_flow_execute_failed', ['error' => $throwable->getMessage()]);
        }
        // 节点内部的异常在 node 的 debug 信息中记录
        foreach ($loopMagicFlow->getNodes() as $node) {
            if ($node->getNodeDebugResult() && ! $node->getNodeDebugResult()->isSuccess()) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loop.loop_flow_execute_failed', ['error' => $node->getNodeDebugResult()->getErrorMessage()]);
            }
        }
    }
}
