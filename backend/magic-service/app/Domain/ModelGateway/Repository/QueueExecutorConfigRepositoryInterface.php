<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;

interface QueueExecutorConfigRepositoryInterface
{
    public function getConfig(string $modelId, string $organizationCode): QueueExecutorConfig;
}
