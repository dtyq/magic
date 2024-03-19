<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity\ValueObject;

class TaskSchedulerExecuteResult
{
    private bool $success;

    private int $cosTime;

    private string $errorMessage = '';

    private mixed $output = null;

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'cos_time' => $this->cosTime,
            'error_message' => $this->errorMessage,
            'output' => serialize($this->output),
        ];
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(bool $success): void
    {
        $this->success = $success;
    }

    public function getCosTime(): int
    {
        return $this->cosTime;
    }

    public function setCosTime(int $cosTime): void
    {
        $this->cosTime = $cosTime;
    }

    public function getErrorMessage(): string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getOutput(): mixed
    {
        return $this->output;
    }

    public function setOutput(mixed $output): void
    {
        $this->output = $output;
    }
}
