<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

readonly class UploadContentToProjectDTO
{
    public function __construct(
        public string $organizationCode,
        public string $projectId,
        public string $fileName,
        public string $content,
        public string $fileExtension,
        public string $userId
    ) {
    }
}
