<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Infrastructure\Core\AbstractEvent;

class ImageGenerateFailedEvent extends AbstractEvent
{
    protected string $organizationCode;

    protected string $userId;

    protected string $model;

    protected string $providerModelId = '';

    protected array $businessParams = [];

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function setBusinessParams(array $businessParams): void
    {
        $this->businessParams = $businessParams;
    }

    public function getBusinessParam(string $key, mixed $default = null): mixed
    {
        return $this->businessParams[$key] ?? $default;
    }
}
