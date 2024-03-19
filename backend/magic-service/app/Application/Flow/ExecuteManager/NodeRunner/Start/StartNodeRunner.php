<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Start;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\StartNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

#[FlowNodeDefine(
    type: NodeType::Start->value,
    code: NodeType::Start->name,
    name: '开始',
    paramsConfig: StartNodeParamsConfig::class,
    version: 'v0',
    singleDebug: true,
    needInput: false,
    needOutput: false
)]
class StartNodeRunner extends AbstractStartNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        // 触发方式从运行数据获取，触发时只能有一个触发方式
        $triggerType = $executionData->getTriggerType();
        if ($appointTriggerType = $frontResults['appoint_trigger_type'] ?? null) {
            if ($appointTriggerType instanceof TriggerType) {
                $triggerType = $appointTriggerType;
            }
        }

        /** @var StartNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $triggerBranch = $paramsConfig->getBranchByTriggerType($triggerType);
        if (empty($triggerBranch)) {
            // 如果没有找到任何触发方式，直接结束就好
            $vertexResult->clearChildren();
            return;
        }

        $this->logger->info(
            'start_node_runner',
            [
                'trigger_type' => $triggerType->name,
                'conversation_id' => $executionData->getOriginConversationId(),
                'message_id' => $executionData->getTriggerData()?->getMessageEntity()->getMagicMessageId(),
            ]
        );
        $result = match ($triggerType) {
            TriggerType::ChatMessage => $this->chatMessage($vertexResult, $executionData, $triggerBranch),
            TriggerType::OpenChatWindow => $this->openChatWindow($vertexResult, $executionData, $triggerBranch),
            TriggerType::AddFriend => $this->addFriend($vertexResult, $executionData, $triggerBranch),
            TriggerType::LoopStart, TriggerType::ParamCall => $this->paramCall($vertexResult, $executionData, $triggerBranch),
            TriggerType::Routine => $this->routine($vertexResult, $executionData, $paramsConfig),
            default => ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.start.unsupported_trigger_type', ['trigger_type' => $triggerType->value]),
        };

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
