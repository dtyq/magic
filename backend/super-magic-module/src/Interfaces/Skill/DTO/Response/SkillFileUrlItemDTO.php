<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * Skill file URL item DTO.
 */
class SkillFileUrlItemDTO implements JsonSerializable
{
    public function __construct(
        private readonly int $id,
        private readonly string $fileKey,
        private readonly ?string $fileUrl,
        private readonly string $sourceType
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => (string) $this->id,
            'file_key' => $this->fileKey,
            'file_url' => $this->fileUrl,
            'source_type' => $this->sourceType,
        ];
    }
}
