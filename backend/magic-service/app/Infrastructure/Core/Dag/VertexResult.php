<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Dag;

class VertexResult
{
    /**
     * 存储需要被调度的子节点.
     * @var array<string>
     */
    protected array $childrenIds = [];

    /**
     * 存储节点的执行结果.
     */
    protected mixed $result = null;

    /**
     * 存储节点的备注信息.
     * 可用于一些日志记录之类的.
     */
    protected mixed $remarkData = null;

    private bool $success = true;

    private string $errorMessage = '';

    private array $input = [];

    private array $debugLog = [];

    public function copy(VertexResult $parentVertexResult): void
    {
        $this->setInput($parentVertexResult->getInput());
        $this->setSuccess($parentVertexResult->getSuccess());
        $this->setErrorMessage($parentVertexResult->getErrorMessage());
        $this->setDebugLog($parentVertexResult->getDebugLog());
        $this->setChildrenIds($parentVertexResult->getChildrenIds());
        $this->setResult($parentVertexResult->getResult());
        $this->setRemarkData($parentVertexResult->getRemarkData());
    }

    public function setErrorMessage(string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
        $this->success = false;
    }

    public function addDebugLog(string $key, mixed $debug): void
    {
        $this->debugLog[$key] = $debug;
    }

    public function setInput(mixed $input): void
    {
        if (! is_array($input)) {
            return;
        }
        $this->input = $input;
    }

    public function clearChildren(): void
    {
        $this->childrenIds = [];
    }

    public function getChildrenIds(): array
    {
        return $this->childrenIds;
    }

    public function setChildrenIds(array $childrenIds): static
    {
        $this->childrenIds = $childrenIds;
        return $this;
    }

    public function getResult(): mixed
    {
        return $this->result;
    }

    public function setResult(mixed $result): static
    {
        $this->result = $result;
        return $this;
    }

    public function getRemarkData(): mixed
    {
        return $this->remarkData;
    }

    public function setRemarkData(mixed $remarkData): static
    {
        $this->remarkData = $remarkData;
        return $this;
    }

    public function getSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(bool $success): static
    {
        $this->success = $success;
        return $this;
    }

    public function getDebugLog(): array
    {
        return $this->debugLog;
    }

    public function hasDebugLog(string $key): bool
    {
        return isset($this->debugLog[$key]);
    }

    public function setDebugLog(array $debugLog): static
    {
        $this->debugLog = $debugLog;
        return $this;
    }

    public function getErrorMessage(): string
    {
        return $this->errorMessage;
    }

    public function getInput(): array
    {
        return $this->input;
    }
}
