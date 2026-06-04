<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Weather\Factory\WeatherAdapterFactory;
use Throwable;

class DataQueryAppService
{
    public function __construct(
        private readonly WeatherAdapterFactory $weatherAdapterFactory,
        private readonly AiAbilityDomainService $aiAbilityDomainService,
    ) {
    }

    public function weatherForecast(string $location, int $days = 3, string $language = 'zh', ?string $provider = null): array
    {
        $dataIsolation = ProviderDataIsolation::create()->disabled();
        $aiAbilityEntity = $this->aiAbilityDomainService->getByCode($dataIsolation, AiAbilityCode::WeatherForecast);

        if (! $aiAbilityEntity || $aiAbilityEntity->getStatus() !== Status::Enabled) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.ability_disabled');
        }

        $providers = $aiAbilityEntity->getConfig()['providers'] ?? [];
        $enabledConfig = $this->resolveProviderConfig($providers, $provider);

        $driverConfig = [
            'api_key' => $enabledConfig['api_key'] ?? '',
            'base_url' => $enabledConfig['request_url'] ?? '',
        ];

        $driverProvider = $enabledConfig['provider'] ?? 'aidata';

        $adapter = $this->weatherAdapterFactory->create($driverProvider, $driverConfig);

        if (! $adapter->isAvailable()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.driver_not_available', ['label' => $driverProvider]);
        }

        try {
            $response = $adapter->forecast($location, $days, $language);
        } catch (Throwable $e) {
            ExceptionBuilder::throw(GenericErrorCode::BasicServiceInterfaceException, 'data_query.request_failed', throwable: $e);
        }

        return $response->toArray();
    }

    private function resolveProviderConfig(array $providers, ?string $requestedProvider): array
    {
        $requestedProvider = strtolower(trim($requestedProvider ?? ''));

        if ($requestedProvider !== '') {
            foreach ($providers as $providerConfig) {
                $providerName = strtolower(trim((string) ($providerConfig['provider'] ?? '')));
                if ($providerName === $requestedProvider) {
                    return $providerConfig;
                }
            }
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.driver_not_configured', ['label' => $requestedProvider]);
        }

        foreach ($providers as $providerConfig) {
            if (($providerConfig['enable'] ?? false) === true) {
                return $providerConfig;
            }
        }

        ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'data_query.no_enabled_provider');
    }
}
