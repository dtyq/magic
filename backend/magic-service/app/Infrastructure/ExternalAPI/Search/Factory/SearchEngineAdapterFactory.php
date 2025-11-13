<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Factory;

use App\Infrastructure\ExternalAPI\Search\Adapter\BingSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\CloudswaySearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\DuckDuckGoSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\GoogleSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\JinaSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\SearchEngineAdapterInterface;
use App\Infrastructure\ExternalAPI\Search\Adapter\TavilySearchAdapter;
use Hyperf\Contract\ConfigInterface;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * Search engine adapter factory.
 * Creates appropriate search engine adapter based on engine name.
 */
class SearchEngineAdapterFactory
{
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly ContainerInterface $container
    ) {
    }

    /**
     * Create search engine adapter.
     *
     * @param null|string $engine Engine name (bing|google|tavily|duckduckgo|jina|cloudsway).
     *                            If null, uses default from config.
     * @throws RuntimeException If engine is not supported
     */
    public function create(?string $engine = null): SearchEngineAdapterInterface
    {
        // Use default engine from config if not specified
        $engine = $engine ?? $this->config->get('search.backend', 'bing');

        // Normalize engine name to lowercase
        $engine = strtolower(trim($engine));

        return match ($engine) {
            'bing' => $this->container->get(BingSearchAdapter::class),
            'google' => $this->container->get(GoogleSearchAdapter::class),
            'tavily' => $this->container->get(TavilySearchAdapter::class),
            'duckduckgo' => $this->container->get(DuckDuckGoSearchAdapter::class),
            'jina' => $this->container->get(JinaSearchAdapter::class),
            'cloudsway' => $this->container->get(CloudswaySearchAdapter::class),
            default => throw new RuntimeException("Unsupported search engine: {$engine}. Supported engines: bing, google, tavily, duckduckgo, jina, cloudsway"),
        };
    }

    /**
     * Get list of all supported search engine names.
     *
     * @return string[]
     */
    public function getSupportedEngines(): array
    {
        return ['bing', 'google', 'tavily', 'duckduckgo', 'jina', 'cloudsway'];
    }

    /**
     * Check if an engine is supported.
     */
    public function isEngineSupported(string $engine): bool
    {
        return in_array(strtolower(trim($engine)), $this->getSupportedEngines(), true);
    }
}
