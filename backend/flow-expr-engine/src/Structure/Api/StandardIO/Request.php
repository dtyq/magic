<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Api\StandardIO;

use Dtyq\FlowExprEngine\Kernel\Utils\Functions;

class Request
{
    private float $time;

    protected function __construct(
        private readonly string $method,
        private readonly string $uri,
        private readonly string $body,
        private readonly array $header
    ) {
        $this->time = microtime(true);
    }

    public function getTime(): float
    {
        return $this->time;
    }

    public function getFormatTime(): string
    {
        return Functions::formatMicroTime($this->time);
    }

    public static function make(string $method, string $uri, string $body, array $header): self
    {
        return new self($method, $uri, $body, $header);
    }

    public function getUri(): string
    {
        return $this->uri;
    }

    public function getMethod(): string
    {
        return strtoupper($this->method);
    }

    public function getBody(): string
    {
        return $this->body;
    }

    public function getHeader(): array
    {
        return $this->header;
    }

    public function show(): array
    {
        return [
            'method' => $this->getMethod(),
            'uri' => $this->getUri(),
            'body' => $this->getBody(),
            'headers' => $this->getHeader(),
            'time' => $this->getFormatTime(),
        ];
    }
}
