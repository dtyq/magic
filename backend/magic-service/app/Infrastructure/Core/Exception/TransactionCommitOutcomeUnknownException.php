<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use Hyperf\Server\Exception\ServerException;
use Throwable;

class TransactionCommitOutcomeUnknownException extends ServerException
{
    public function __construct(Throwable $previous)
    {
        parent::__construct('事务提交结果未知，停止后续操作并核验原记录', 0, $previous);
    }
}
