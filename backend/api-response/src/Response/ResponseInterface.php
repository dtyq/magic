<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Response;

interface ResponseInterface
{
    /**
     * 成功响应.
     */
    public function success(mixed $data): static;

    /**
     * 失败响应.
     */
    public function error(int $code, string $message, mixed $data = null): static;

    /**
     * 返回结构体定义.
     */
    public function body(): array;
}
