<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow;

interface NodeParamsPluginInterface
{
    public function getParamsTemplate(): array;

    public function parseParams(array $params): array;
}
