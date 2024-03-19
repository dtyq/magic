<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

class ConnectivityTestByConfigRequest extends AbstractRequestDTO
{
    protected string $providerCode = '';

    protected string $modelVersion = '';

    protected ?string $category = 'llm';

    protected ?int $modelType = 3;

    protected string $serviceProviderConfigId = '';

    protected array $serviceProviderConfig = [];

    public static function getHyperfValidationRules(): array
    {
        return [
            'service_provider_config_id' => 'string|nullable',
            'provider_code' => 'string|nullable|required_without:service_provider_config_id',
            'service_provider_config' => 'array|nullable|required_without:service_provider_config_id',
            'category' => 'string|nullable',
            'model_version' => 'required|string',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'service_provider_config_id.string' => __('service_provider.provider.service_provider_config_id.string'),
            'provider_code.required_without' => __('service_provider.provider.provider_code.required_without'),
            'provider_code.string' => __('service_provider.provider.provider_code.string'),
            'service_provider_config.required_without' => __('service_provider.provider.service_provider_config.required_without'),
            'service_provider_config.array' => __('service_provider.provider.service_provider_config.array'),
            'category.string' => __('service_provider.provider.category.string'),
            'model_version.required' => __('service_provider.provider.model_version.required'),
            'model_version.string' => __('service_provider.provider.model_version.string'),
        ];
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function setProviderCode(null|int|string $providerCode): void
    {
        if ($providerCode === null) {
            $this->providerCode = '';
        } else {
            $this->providerCode = (string) $providerCode;
        }
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(null|int|string $modelVersion): void
    {
        if ($modelVersion === null) {
            $this->modelVersion = '';
        } else {
            $this->modelVersion = (string) $modelVersion;
        }
    }

    public function getServiceProviderConfigId(): string
    {
        return $this->serviceProviderConfigId;
    }

    public function setServiceProviderConfigId(null|int|string $serviceProviderConfigId): void
    {
        if ($serviceProviderConfigId === null) {
            $this->serviceProviderConfigId = '';
        } else {
            $this->serviceProviderConfigId = (string) $serviceProviderConfigId;
        }
    }

    public function getServiceProviderConfig(): array
    {
        return $this->serviceProviderConfig;
    }

    public function setServiceProviderConfig(null|array|string $serviceProviderConfig): void
    {
        if ($serviceProviderConfig === null) {
            $this->serviceProviderConfig = [];
        } elseif (is_string($serviceProviderConfig) && json_validate($serviceProviderConfig)) {
            $decoded = json_decode($serviceProviderConfig, true);
            $this->serviceProviderConfig = is_array($decoded) ? $decoded : [];
        } elseif (is_array($serviceProviderConfig)) {
            $this->serviceProviderConfig = $serviceProviderConfig;
        } else {
            $this->serviceProviderConfig = [];
        }
    }

    public function getCategory(): ?string
    {
        return $this->category;
    }

    public function setCategory(?string $category): void
    {
        $this->category = $category;
    }

    public function getModelType(): ?int
    {
        return $this->modelType;
    }

    public function setModelType(?int $modelType): void
    {
        $this->modelType = $modelType;
    }
}
