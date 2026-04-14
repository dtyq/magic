<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;

class VideoModel
{
    public function __construct(
        protected array $config,
        protected string $modelVersion,
        protected string $providerModelId,
        protected ProviderCode $providerCode,
    ) {
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function getProviderCode(): ProviderCode
    {
        return $this->providerCode;
    }
}
