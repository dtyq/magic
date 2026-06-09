<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Weather\Factory;

use App\Infrastructure\ExternalAPI\Weather\Adapter\AiDataWeatherAdapter;
use App\Infrastructure\ExternalAPI\Weather\Adapter\WeatherAdapterInterface;
use RuntimeException;

use function Hyperf\Support\make;

class WeatherAdapterFactory
{
    /**
     * Create weather adapter by provider name.
     *
     * @param string $provider Provider name (e.g., 'aidata')
     * @param array $config Driver configuration (api_key, base_url, etc.)
     * @throws RuntimeException If provider is not supported
     */
    public function create(string $provider, array $config = []): WeatherAdapterInterface
    {
        $provider = strtolower(trim($provider));

        return match ($provider) {
            'aidata' => make(AiDataWeatherAdapter::class, ['config' => $config]),
            default => throw new RuntimeException("Unsupported weather provider: {$provider}. Supported providers: aidata"),
        };
    }

    public function getSupportedProviders(): array
    {
        return ['aidata'];
    }
}
