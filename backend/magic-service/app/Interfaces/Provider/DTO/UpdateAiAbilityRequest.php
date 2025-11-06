<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

class UpdateAiAbilityRequest extends AbstractDTO
{
    protected string $code;

    protected ?int $status = null;

    protected ?array $config = null;

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getConfig(): ?array
    {
        return $this->config;
    }

    public function setConfig(?array $config): void
    {
        $this->config = $config;
    }

    public function hasStatus(): bool
    {
        return $this->status !== null;
    }

    public function hasConfig(): bool
    {
        return $this->config !== null;
    }
}
