<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event;

use App\Domain\Chat\Entity\ValueObject\MessagePriority;

interface ChatEventInterface
{
    public function getPriority(): MessagePriority;

    public function setPriority(MessagePriority $priority): void;
}
