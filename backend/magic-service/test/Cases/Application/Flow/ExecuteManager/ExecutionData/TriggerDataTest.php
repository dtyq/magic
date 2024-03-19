<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\ExecutionData;

use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use DateTime;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class TriggerDataTest extends ExecuteManagerBaseTest
{
    public function testGet()
    {
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname(), $operator->getOrganizationCode())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
        );
        $this->assertIsArray($triggerData->getUserExtInfo()->getDepartments());
    }
}
