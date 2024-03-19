<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\MessagePush;

use App\Domain\Chat\Entity\ValueObject\MessagePriority;
use Hyperf\Amqp\Annotation\Consumer;

#[Consumer(nums: 2)]
class HighestPriorityPushSubscriber extends AbstractSeqPushSubscriber
{
    protected MessagePriority $priority = MessagePriority::Highest;
}
