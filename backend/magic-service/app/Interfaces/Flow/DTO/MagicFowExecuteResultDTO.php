<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

class MagicFowExecuteResultDTO extends AbstractFlowDTO
{
    public string $taskId;

    public int $status;

    public string $statusLabel;

    public array $result;

    public function setTaskId(?string $taskId): void
    {
        $this->taskId = $taskId ?? '';
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status ?? 0;
    }

    public function getStatusLabel(): string
    {
        return $this->statusLabel;
    }

    public function setStatusLabel(?string $statusLabel): void
    {
        $this->statusLabel = $statusLabel ?? '';
    }

    public function getResult(): array
    {
        return $this->result;
    }

    public function setResult(?array $result): void
    {
        $this->result = $result ?? [];
    }
}
