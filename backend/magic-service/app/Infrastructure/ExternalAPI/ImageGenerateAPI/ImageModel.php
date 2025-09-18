<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

class ImageModel
{
    protected array $config = [];

    protected string $modelVersion;

    protected string $providerModelId;

    public function __construct(array $config, string $modelVersion, string $providerModelId)
    {
        $this->config = $config;
        $this->modelVersion = $modelVersion;
        $this->providerModelId = $providerModelId;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function setConfig(array $config): void
    {
        $this->config = $config;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(string $modelVersion): void
    {
        $this->modelVersion = $modelVersion;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
    }
}
