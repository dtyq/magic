<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\ErrorCode\DataQueryErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Weather\Factory\WeatherAdapterFactory;
use Hyperf\Contract\ConfigInterface;
use Throwable;

class DataQueryAppService
{
    public function __construct(
        private readonly WeatherAdapterFactory $weatherAdapterFactory,
        private readonly ConfigInterface $config,
    ) {
    }

    public function weatherForecast(string $location, int $days = 3, string $language = 'zh', ?string $provider = null): array
    {
        $provider = $provider ?: $this->config->get('weather.default', 'aidata');
        $driverConfig = $this->config->get("weather.drivers.{$provider}", []);

        if (empty($driverConfig)) {
            ExceptionBuilder::throw(DataQueryErrorCode::DRIVER_NOT_CONFIGURED, "Weather driver [{$provider}] is not configured");
        }

        $adapter = $this->weatherAdapterFactory->create($provider, $driverConfig);

        if (! $adapter->isAvailable()) {
            ExceptionBuilder::throw(DataQueryErrorCode::DRIVER_NOT_AVAILABLE, "Weather driver [{$provider}] is not available");
        }

        try {
            $response = $adapter->forecast($location, $days, $language);
        } catch (Throwable $e) {
            ExceptionBuilder::throw(DataQueryErrorCode::REQUEST_FAILED, $e->getMessage(), throwable: $e);
        }

        return $response->toArray();
    }
}
