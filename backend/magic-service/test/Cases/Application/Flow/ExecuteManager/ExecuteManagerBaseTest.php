<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\Operator;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Kernel\EnvManager;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use DateTime;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ExecuteManagerBaseTest extends BaseTest
{
    protected function createExecutionData(
        TriggerType $triggerType = TriggerType::None,
        ?TriggerData $triggerData = null,
        ExecutionType $executionType = ExecutionType::Debug
    ): ExecutionData {
        $operator = $this->getOperator();

        if (! $triggerData) {
            $triggerData = new TriggerData(
                triggerTime: new DateTime(),
                userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname(), $operator->getOrganizationCode())],
                messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
                params: [],
            );
        }
        $flowDataIsolation = FlowDataIsolation::create($operator->getOrganizationCode(), $operator->getUid());
        EnvManager::initDataIsolationEnv($flowDataIsolation);

        $executionData = new ExecutionData(
            flowDataIsolation: $flowDataIsolation,
            operator: $operator,
            triggerType: $triggerType,
            triggerData: $triggerData,
            conversationId: 'unit-test_' . uniqid(),
            executionType: $executionType,
        );
        $executionData->setFlowCode('MAGIC-FLOW-123456789abcde2-12345601', 'MAGIC-FLOW-VERSION-123456789abcde3-12345602', $operator->getUid());
        $executionData->setDebug(true);
        return $executionData;
    }

    protected function getOperator(): Operator
    {
        $operator = new Operator();
        $operator->setUid('usi_123456789abcdef123456789abcdef14');
        $operator->setNickname('unit-test-nickname');
        $operator->setRealName('unit-test-real_name');
        $operator->setAvatar('unit-test-avatar');
        $operator->setOrganizationCode('DT001');
        $operator->setMagicId('123456789012345680');
        return $operator;
    }
}
