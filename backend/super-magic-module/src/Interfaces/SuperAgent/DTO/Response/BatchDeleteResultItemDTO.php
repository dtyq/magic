<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * Batch delete result item DTO.
 */
class BatchDeleteResultItemDTO
{
    public function __construct(
        private readonly int $projectId,
        private readonly bool $success,
        private readonly ?string $errorCode = null,
        private readonly ?string $errorMessage = null
    ) {
    }

    public function toArray(): array
    {
        return [
            'project_id' => $this->projectId,
            'success' => $this->success,
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
        ];
    }
}
