<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Facade;

interface MicroAppVisitRepositoryInterface
{
    public function recordVisit(int $microAppId, string $userId, string $organizationCode): void;
}
