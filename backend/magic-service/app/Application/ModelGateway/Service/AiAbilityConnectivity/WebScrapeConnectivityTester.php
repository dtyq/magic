<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Infrastructure\ExternalAPI\WebScrape\WebScrapeFactory;
use RuntimeException;

class WebScrapeConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::WebScrape;
    }

    public function test(array $aiAbilityConfig, array $enabledProviderConfig): array
    {
        if (! WebScrapeFactory::validateConfig($aiAbilityConfig)) {
            throw new RuntimeException('Web scrape configuration is invalid');
        }

        $webScrape = WebScrapeFactory::create($aiAbilityConfig);

        $startTime = microtime(true);
        $webScrape->scrape(
            url: 'https://example.com',
            formats: ['MARKDOWN'],
            mode: 'fast',
            options: []
        );

        return [
            'provider' => $webScrape->getPlatformName(),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ((microtime(true) - $startTime) * 1000),
        ];
    }
}
