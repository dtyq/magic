<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Protocol;

class Request
{
    public function __construct(
        public string $method,
        public array $params = [],
        public mixed $id = null,
        public array $context = []
    ) {
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function getId(): mixed
    {
        return $this->id;
    }

    public function getContext(): array
    {
        return $this->context;
    }
}
