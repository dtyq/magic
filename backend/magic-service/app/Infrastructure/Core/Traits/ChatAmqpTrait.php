<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

use App\Domain\Chat\Entity\ValueObject\AmqpTopicType;
use App\Domain\Chat\Entity\ValueObject\MessagePriority;

trait ChatAmqpTrait
{
    public function getExchangeName(AmqpTopicType $topicType): string
    {
        return $topicType->value;
    }

    // 路由件
    public function getRoutingKeyName(AmqpTopicType $topicType, MessagePriority $priority): string
    {
        return sprintf('%s.%s', $topicType->value, $priority->name);
    }
}
