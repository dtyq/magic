<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points;

interface PointComponentInterface
{
    public function checkPointsSufficient(string $organizationCode, string $userId): void;
}
