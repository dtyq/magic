<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Types\Message;

interface MessageInterface
{
    public function getId(): int;

    public function getMethod(): string;

    public function getJsonRpc(): string;

    public function getParams(): ?array;
}
