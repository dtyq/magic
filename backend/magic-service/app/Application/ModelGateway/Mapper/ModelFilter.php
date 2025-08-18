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

    protected ?string $currentPackage = null;

    public function __construct(
        protected bool $checkModelEnabled = true,
        protected bool $checkProviderEnabled = true,
        protected bool $checkVisibleOrganization = true,
        protected bool $checkVisibleApplication = true,
        protected bool $checkVisiblePackage = true,
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

    public function getCurrentPackage(): ?string
    {
        return $this->currentPackage;
    }

    public function setCurrentPackage(?string $currentPackage): void
    {
        $this->currentPackage = $currentPackage;
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
        // 新版使用套餐过滤器，组织可见性不需要检查了
        return false;
    }

    public function setCheckVisibleOrganization(bool $checkVisibleOrganization): void
    {
        $this->checkVisibleOrganization = $checkVisibleOrganization;
    }

    public function isCheckVisibleApplication(): bool
    {
        // 新版使用套餐过滤器，应用可见性不需要检查了
        return false;
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

    public function isCheckVisiblePackage(): bool
    {
        if (is_null($this->currentPackage)) {
            return false;
        }
        return $this->checkVisiblePackage;
    }

    public function setCheckVisiblePackage(bool $checkVisiblePackage): void
    {
        $this->checkVisiblePackage = $checkVisiblePackage;
    }
}
