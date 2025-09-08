<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;

readonly class ProcessSummaryTaskDTO
{
    public function __construct(
        public AsrTaskStatusDTO $taskStatus,
        public string $organizationCode,
        public string $projectId,
        public string $userId,
        public string $topicId,
        public string $conversationId,
        public string $modelId
    ) {
    }
}
