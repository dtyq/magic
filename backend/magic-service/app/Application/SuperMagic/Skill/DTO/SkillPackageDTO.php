<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\DTO;

final readonly class SkillPackageDTO
{
    public function __construct(
        public string $fileKey,
        public string $packageName,
        public string $packageDescription,
        public ?string $skillCode = null,
        public array $manifest = [],
        public string $sha256 = '',
    ) {
    }
}
