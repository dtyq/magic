<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Start;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\MagicFlowWaitMessageEntity;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\WaitMessageNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Service\MagicFlowWaitMessageDomainService;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;

#[FlowNodeDefine(
    type: NodeType::WaitMessage->value,
    code: NodeType::WaitMessage->name,
    name: '等待',
    paramsConfig: WaitMessageNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true
)]
class WaitMessageNodeRunner extends AbstractStartNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $dataIsolation = $executionData->getDataIsolation();
        $waitMessageDomainService = di(MagicFlowWaitMessageDomainService::class);

        // 如果是作为开始节点
        if ($executionData->getTriggerType() === TriggerType::WaitMessage) {
            $result = $this->chatMessage($vertexResult, $executionData);
            $vertexResult->setResult($result);
            $executionData->saveNodeContext($this->node->getNodeId(), $result);
            return;
        }

        // 如果是作为运行节点 仅记录，然后结束当前执行
        $waitMessageEntity = new MagicFlowWaitMessageEntity();
        $waitMessageEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $waitMessageEntity->setConversationId($executionData->getConversationId());
        $waitMessageEntity->setOriginConversationId($executionData->getOriginConversationId());
        $waitMessageEntity->setMessageId($executionData->getTriggerData()->getMessageEntity()->getMagicMessageId());
        $waitMessageEntity->setWaitNodeId($this->node->getNodeId());
        $waitMessageEntity->setFlowCode($executionData->getFlowCode());
        $waitMessageEntity->setFlowVersion($executionData->getFlowVersion());
        $waitMessageEntity->setCreator($executionData->getOperator()->getUid());
        // 计算 timeout
        $params = $this->node->getParams();
        $timeoutConfig = $params['timeout_config'] ?? [];
        if ($timeoutConfig['enabled'] ?? false) {
            $intervalSeconds = $this->getIntervalSeconds($timeoutConfig['interval'] ?? 0, $timeoutConfig['unit'] ?? '');
            $waitMessageEntity->setTimeout(time() + $intervalSeconds);
        }

        // 暂时还是放到数据库中，后续考虑放到 对象存储 中
        $persistenceData = $executionData->getPersistenceData();
        $waitMessageEntity->setPersistentData($persistenceData);

        $waitMessageDomainService->save(
            dataIsolation: $executionData->getDataIsolation(),
            savingWaitMessageEntity: $waitMessageEntity
        );

        $vertexResult->setChildrenIds([]);
    }
}
