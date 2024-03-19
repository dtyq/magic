<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor;

class ExecutionRequest implements \JsonSerializable
{
    /**
     * @param Language $language 执行的语言
     * @param string $code 要执行的代码
     * @param array<string, mixed> $args 执行代码时传入的参数
     * @param int $timeout 执行超时时间（秒）
     */
    public function __construct(
        private Language $language,
        private string $code,
        private array $args = [],
        private int $timeout = 30
    ) {}

    public function getLanguage(): Language
    {
        return $this->language;
    }

    public function setLanguage(Language $language): ExecutionRequest
    {
        $this->language = $language;
        return $this;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): ExecutionRequest
    {
        $this->code = $code;
        return $this;
    }

    public function getArgs(): array
    {
        return $this->args;
    }

    public function setArgs(array $args): ExecutionRequest
    {
        $this->args = $args;
        return $this;
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function setTimeout(int $timeout): ExecutionRequest
    {
        $this->timeout = $timeout;
        return $this;
    }

    public function jsonSerialize(): array
    {
        return get_object_vars($this);
    }
}
