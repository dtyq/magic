<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use Qbhy\HyperfAuth\Authenticatable;

interface HandleDataIsolationInterface
{
    public function handleByAuthorization(Authenticatable $authorization, BaseDataIsolation $baseDataIsolation, int &$envId): void;
}
