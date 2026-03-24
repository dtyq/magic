<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event;

use App\Infrastructure\Core\AbstractEvent;

class FollowUpSuggestionGenerateEvent extends AbstractEvent
{
    public function __construct(
        public readonly string $organizationCode,
        public readonly string $userId,
        public readonly int $topicId,
        public readonly string $taskId,
        public readonly ?string $language = null,
    ) {
    }
}
