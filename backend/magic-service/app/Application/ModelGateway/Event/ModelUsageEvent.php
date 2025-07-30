<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event;

use Hyperf\Odin\Api\Response\Usage;

class ModelUsageEvent
{
    public function __construct(
        public string $modelType,
        public string $modelId,
        public string $modelVersion,
        public Usage $usage,
        public string $organizationCode,
        public string $userId,
        public string $appId = '',
        public string $serviceProviderModelId = '',
        public array $businessParams = [],
    ) {
    }

    public function getBusinessParam(string $key, mixed $default = null): mixed
    {
        return $this->businessParams[$key] ?? $default;
    }

    public function getModelType(): string
    {
        return $this->modelType;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getUsage(): Usage
    {
        return $this->usage;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getAppId(): string
    {
        return $this->appId;
    }

    public function getServiceProviderModelId(): string
    {
        return $this->serviceProviderModelId;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function toArray(): array
    {
        return [
            'model_type' => $this->modelType,
            'model_id' => $this->modelId,
            'model_version' => $this->modelVersion,
            'usage' => $this->usage->toArray(),
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'app_id' => $this->appId,
            'service_provider_model_id' => $this->serviceProviderModelId,
            'business_params' => $this->businessParams,
        ];
    }
}
