<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Infrastructure\ExternalAPI\Search\Factory\SearchEngineAdapterFactory;
use RuntimeException;

class WebSearchConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function __construct(
        private readonly SearchEngineAdapterFactory $searchEngineAdapterFactory,
    ) {
    }

    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::WebSearch;
    }

    public function test(array $aiAbilityConfig, array $enabledProviderConfig): array
    {
        $provider = (string) ($enabledProviderConfig['provider'] ?? '');
        $adapter = $this->searchEngineAdapterFactory->create($provider, $enabledProviderConfig);

        if (! $adapter->isAvailable()) {
            throw new RuntimeException(sprintf(
                "Search engine '%s' is not available (API key not configured or service unavailable)",
                $adapter->getEngineName()
            ));
        }

        $startTime = microtime(true);
        $adapter->search(
            query: 'connectivity test',
            mkt: 'en-US',
            count: 1,
            offset: 0,
            safeSearch: 'Off',
            freshness: '',
            setLang: 'en'
        );

        return [
            'provider' => $adapter->getEngineName(),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ((microtime(true) - $startTime) * 1000),
        ];
    }
}
