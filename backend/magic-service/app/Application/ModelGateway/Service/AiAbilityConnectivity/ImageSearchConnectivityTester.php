<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Infrastructure\ExternalAPI\ImageSearch\Factory\ImageSearchEngineAdapterFactory;
use RuntimeException;

class ImageSearchConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function __construct(
        private readonly ImageSearchEngineAdapterFactory $imageSearchEngineAdapterFactory,
    ) {
    }

    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::ImageSearch;
    }

    public function test(array $aiAbilityConfig, array $enabledProviderConfig): array
    {
        $provider = (string) ($enabledProviderConfig['provider'] ?? '');
        $adapter = $this->imageSearchEngineAdapterFactory->create($provider, $enabledProviderConfig);

        if (! $adapter->isAvailable()) {
            throw new RuntimeException(sprintf(
                "Image search provider '%s' is not available (API key not configured or service unavailable)",
                $adapter->getEngineName()
            ));
        }

        $startTime = microtime(true);
        $adapter->imageSearch(
            query: 'connectivity test',
            count: 1,
            offset: 0
        );

        return [
            'provider' => $adapter->getEngineName(),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ((microtime(true) - $startTime) * 1000),
        ];
    }
}
