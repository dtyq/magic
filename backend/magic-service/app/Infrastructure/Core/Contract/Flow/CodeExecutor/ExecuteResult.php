<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow\CodeExecutor;

class ExecuteResult
{
    private mixed $result;

    private string $debug;

    public function __construct(mixed $result, string $debug)
    {
        $this->result = $result;
        $this->debug = $debug;
    }

    public function getResult(): mixed
    {
        return $this->result;
    }

    public function getDebug(): string
    {
        return $this->debug;
    }
}
