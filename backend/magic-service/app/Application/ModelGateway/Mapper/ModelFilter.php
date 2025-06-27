<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

class ModelFilter
{
    public function __construct(
        protected ?string $appId = null,
        protected bool $checkModelEnabled = true,
        protected bool $checkProviderEnabled = true,
    ) {
    }

    public function getAppId(): ?string
    {
        return $this->appId;
    }

    public function setAppId(?string $appId): void
    {
        $this->appId = $appId;
    }

    public function isCheckModelEnabled(): bool
    {
        return $this->checkModelEnabled;
    }

    public function setCheckModelEnabled(bool $checkModelEnabled): void
    {
        $this->checkModelEnabled = $checkModelEnabled;
    }

    public function isCheckProviderEnabled(): bool
    {
        return $this->checkProviderEnabled;
    }

    public function setCheckProviderEnabled(bool $checkProviderEnabled): void
    {
        $this->checkProviderEnabled = $checkProviderEnabled;
    }
}
