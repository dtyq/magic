<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Topic\DTO;

final readonly class TopicAgentConfig
{
    public function __construct(
        public string $topicMode,
        public string $agentCode,
    ) {
    }
}
