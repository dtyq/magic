<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\ErrorCode\GenericErrorCode;
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
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.driver_not_configured', ['label' => $provider]);
        }

        $adapter = $this->weatherAdapterFactory->create($provider, $driverConfig);

        if (! $adapter->isAvailable()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.driver_not_available', ['label' => $provider]);
        }

        try {
            $response = $adapter->forecast($location, $days, $language);
        } catch (Throwable $e) {
            ExceptionBuilder::throw(GenericErrorCode::BasicServiceInterfaceException, 'data_query.request_failed', throwable: $e);
        }

        return $response->toArray();
    }
}
