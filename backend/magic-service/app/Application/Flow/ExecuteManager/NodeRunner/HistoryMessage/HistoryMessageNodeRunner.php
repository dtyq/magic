<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\HistoryMessage;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\Memory\MemoryQuery;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\HistoryMessage\HistoryMessageQueryNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use DateTime;

#[FlowNodeDefine(
    type: NodeType::HistoryMessage->value,
    code: NodeType::HistoryMessage->name,
    name: '历史消息 / 查询',
    paramsConfig: HistoryMessageQueryNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class HistoryMessageNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();

        $maxRecord = (int) ($params['max_record'] ?? 10);
        $startTime = null;
        $endTime = null;
        if (! empty($params['start_time']) && strtotime($params['start_time']) !== false) {
            $startTime = new DateTime($params['start_time']);
        }
        if (! empty($params['end_time']) && strtotime($params['end_time']) !== false) {
            $endTime = new DateTime($params['end_time']);
        }

        $memoryQuery = new MemoryQuery(
            $executionData->getExecutionType(),
            $executionData->getConversationId(),
            $executionData->getOriginConversationId(),
            $executionData->getTopicId(),
            $maxRecord
        );
        $memoryQuery->setStartTime($startTime);
        $memoryQuery->setEndTime($endTime);

        $memories = $this->flowMemoryManager->queries($memoryQuery);

        $historyMessages = [];
        foreach ($memories as $memory) {
            $historyMessages[] = $memory->toOdinMessage()->toArray();
        }

        $result = [
            'history_messages' => $historyMessages,
        ];

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
