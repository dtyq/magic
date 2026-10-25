<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

final class ReferencedProjectMount
{
    public function __construct(
        public readonly string $projectId,
        public readonly ReferencedProjectAccessKind $accessKind,
        public readonly string $sourceType,
        public readonly ?string $appId = null,
    ) {
    }
}
