<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;

readonly class UploadFilesToProjectWorkspaceDTO
{
    public function __construct(
        public string $organizationCode,
        public AsrTaskStatusDTO $taskStatus,
        public string $projectId,
        public string $transcriptionContent,
        public bool $forceRetry = false
    ) {
    }
}
