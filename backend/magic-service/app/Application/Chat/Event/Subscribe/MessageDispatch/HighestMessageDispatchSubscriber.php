<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\MessageDispatch;

use App\Domain\Chat\Entity\ValueObject\MessagePriority;
use Hyperf\Amqp\Annotation\Consumer;

#[Consumer(nums: 2)]
class HighestMessageDispatchSubscriber extends AbstractMessageDispatchSubscriber
{
    protected MessagePriority $priority = MessagePriority::Highest;
}
