<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use RuntimeException;
use Throwable;

class BusinessException extends RuntimeException
{
    private array $data = [];

    public function __construct(string $message = '', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function hasData(): bool
    {
        return $this->data !== [];
    }
}
