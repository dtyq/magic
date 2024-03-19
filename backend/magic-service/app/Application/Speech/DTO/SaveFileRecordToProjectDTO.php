<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

readonly class SaveFileRecordToProjectDTO
{
    public function __construct(
        public string $organizationCode,
        public string $projectId,
        public string $fileKey,
        public string $fileName,
        public int $fileSize,
        public string $fileExtension,
        public string $userId,
        public ?int $duration = null
    ) {
    }
}
