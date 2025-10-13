<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\SpeechRecognitionResultDTO;

readonly class HandleQueryResultDTO
{
    public function __construct(
        public SpeechRecognitionResultDTO $result,
        public AsrTaskStatusDTO $taskStatus,
        public string $organizationCode,
        public string $projectId,
        public int $retry
    ) {
    }
}
