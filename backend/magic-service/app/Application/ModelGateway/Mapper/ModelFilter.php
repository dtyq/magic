<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

class ModelFilter
{
    protected ?string $appId = null;

    protected ?string $originModel = null;

    public function __construct(
        protected bool $checkModelEnabled = true,
        protected bool $checkProviderEnabled = true,
        protected bool $checkVisibleOrganization = true,
        protected bool $checkVisibleApplication = true,
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

    public function isCheckVisibleOrganization(): bool
    {
        return $this->checkVisibleOrganization;
    }

    public function setCheckVisibleOrganization(bool $checkVisibleOrganization): void
    {
        $this->checkVisibleOrganization = $checkVisibleOrganization;
    }

    public function isCheckVisibleApplication(): bool
    {
        return $this->checkVisibleApplication;
    }

    public function setCheckVisibleApplication(bool $checkVisibleApplication): void
    {
        $this->checkVisibleApplication = $checkVisibleApplication;
    }

    public function getOriginModel(): ?string
    {
        return $this->originModel;
    }

    public function setOriginModel(?string $originModel): void
    {
        $this->originModel = $originModel;
    }
}
