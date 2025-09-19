<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class FileInfoResponseDTO
{
    public function __construct(
        public readonly string $fileName,
        public readonly int $currentVersion,
        public readonly string $organizationCode
    ) {
    }

    public function toArray(): array
    {
        return [
            'file_name' => $this->fileName,
            'version' => $this->currentVersion,
            'organization_code' => $this->organizationCode,
        ];
    }
}
