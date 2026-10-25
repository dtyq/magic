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

    /** 根据服务商配置创建队列执行配置，provider 私有配置保留在 extraConfig。 */
    public static function fromProviderConfig(
        array $providerConfig,
        int $pollIntervalSeconds = 3,
        int $maxPollTimes = 200,
    ): self {
        $baseUrl = self::firstNonEmptyString($providerConfig, ['url', 'base_url']);
        $apiKey = self::firstNonEmptyString($providerConfig, ['api_key', 'apiKey']);

        return new self(
            baseUrl: $baseUrl,
            apiKey: $apiKey,
            pollIntervalSeconds: max(1, $pollIntervalSeconds),
            maxPollTimes: max(20, $maxPollTimes),
            extraConfig: $providerConfig,
        );
    }

    public function getBaseUrl(): string
    {
        return rtrim($this->baseUrl, '/');
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

    /** @return array<string, mixed> */
    public function getExtraConfig(): array
    {
        return $this->extraConfig;
    }

    /**
     * 按优先级返回第一个非空字符串配置项。
     */
    private static function firstNonEmptyString(array $config, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $config[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }
}
