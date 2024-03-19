<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\ExecuteResult;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PythonExecutorInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class PythonExecutor implements PythonExecutorInterface
{
    public function execute(string $organizationCode, string $code, array $sourceData = []): ExecuteResult
    {
        ExceptionBuilder::throw(GenericErrorCode::NotImplemented);
    }
}
