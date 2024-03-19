<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\Factory;

use App\Infrastructure\ExternalAPI\ImageSearch\Adapter\BingImageSearchAdapter;
use App\Infrastructure\ExternalAPI\ImageSearch\Adapter\CloudswayImageSearchAdapter;
use App\Infrastructure\ExternalAPI\ImageSearch\Adapter\ImageSearchEngineAdapterInterface;
use App\Infrastructure\ExternalAPI\ImageSearch\Adapter\SerpApiImageSearchAdapter;
use RuntimeException;

use function Hyperf\Support\make;

/**
 * Image search engine adapter factory.
 * Creates appropriate image search engine adapter based on provider name.
 */
class ImageSearchEngineAdapterFactory
{
    /**
     * Create image search engine adapter.
     *
     * @param string $provider Provider name (bing|google|serpapi|cloudsway)
     * @param array $providerConfig Configuration array from AI abilities config field
     * @throws RuntimeException If provider is not supported
     */
    public function create(string $provider, array $providerConfig = []): ImageSearchEngineAdapterInterface
    {
        // Normalize provider name to lowercase
        $provider = strtolower(trim($provider));

        return match ($provider) {
            'bing' => make(BingImageSearchAdapter::class, ['providerConfig' => $providerConfig]),
            'google', 'serpapi' => make(SerpApiImageSearchAdapter::class, ['providerConfig' => $providerConfig]),
            'cloudsway' => make(CloudswayImageSearchAdapter::class, ['providerConfig' => $providerConfig]),
            default => throw new RuntimeException("Unsupported image search provider: {$provider}. Supported providers: bing, google, serpapi, cloudsway"),
        };
    }

    /**
     * Get list of all supported provider names.
     *
     * @return string[]
     */
    public function getSupportedProviders(): array
    {
        return ['bing', 'google', 'serpapi', 'cloudsway'];
    }

    /**
     * Check if a provider is supported.
     */
    public function isProviderSupported(string $provider): bool
    {
        return in_array(strtolower(trim($provider)), $this->getSupportedProviders(), true);
    }
}
