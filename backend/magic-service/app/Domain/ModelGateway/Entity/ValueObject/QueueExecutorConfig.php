<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

readonly class QueueExecutorConfig
{
    public function __construct(
        private string $baseUrl,
        private string $apiKey,
        private int $pollIntervalSeconds,
        private int $maxPollTimes,
        private array $extraConfig = [],
    ) {
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function getPollIntervalSeconds(): int
    {
        return $this->pollIntervalSeconds;
    }

    public function getMaxPollTimes(): int
    {
        return $this->maxPollTimes;
    }

    public function getExtraString(string $key, string $default = ''): string
    {
        $value = $this->extraConfig[$key] ?? null;
        if (! is_scalar($value)) {
            return $default;
        }

        $normalized = trim((string) $value);
        return $normalized !== '' ? $normalized : $default;
    }
}
