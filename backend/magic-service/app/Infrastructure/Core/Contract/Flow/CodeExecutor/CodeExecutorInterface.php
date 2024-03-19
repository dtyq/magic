<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow\CodeExecutor;

interface CodeExecutorInterface
{
    public function execute(string $organizationCode, string $code, array $sourceData = []): ExecuteResult;
}
