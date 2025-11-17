<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Factory;

use App\Infrastructure\ExternalAPI\Search\Adapter\SearchEngineAdapterInterface;
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
     * @throws RuntimeException If engine is not supported or class not found
     */
    public function create(?string $engine = null): SearchEngineAdapterInterface
    {
        // Use default engine from config if not specified
        $engine = $engine ?? $this->config->get('search.backend', 'bing');

        // Normalize engine name to lowercase
        $engine = strtolower(trim($engine));

        // Get driver configuration
        $driverConfig = $this->config->get("search.drivers.{$engine}");

        if (empty($driverConfig)) {
            $supportedEngines = implode(', ', $this->getSupportedEngines());
            throw new RuntimeException("Unsupported search engine: {$engine}. Supported engines: {$supportedEngines}");
        }

        // Get adapter class name from config
        $className = $driverConfig['class_name'] ?? null;

        if (empty($className)) {
            throw new RuntimeException("No class_name configured for search engine: {$engine}");
        }

        if (! class_exists($className)) {
            throw new RuntimeException("Adapter class not found: {$className}");
        }

        return $this->container->get($className);
    }

    /**
     * Get list of all supported search engine names.
     *
     * @return string[]
     */
    public function getSupportedEngines(): array
    {
        $drivers = $this->config->get('search.drivers', []);
        return array_keys($drivers);
    }

    /**
     * Check if an engine is supported.
     */
    public function isEngineSupported(string $engine): bool
    {
        return in_array(strtolower(trim($engine)), $this->getSupportedEngines(), true);
    }
}

