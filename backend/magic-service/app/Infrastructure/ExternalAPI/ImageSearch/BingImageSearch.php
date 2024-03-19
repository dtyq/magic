<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

class BingImageSearch
{
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 30;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Execute Bing image search.
     *
     * @param string $query Search query
     * @param string $subscriptionKey Bing API subscription key
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $requestUrl Request URL (e.g., https://api.bing.microsoft.com/v7.0)
     * @return array Native Bing Image Search API response
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $subscriptionKey,
        int $count = 10,
        int $offset = 0,
        string $requestUrl = ''
    ): array {
        if (empty($requestUrl)) {
            throw new RuntimeException('Bing Image Search endpoint is not configured');
        }

        // Ensure endpoint ends with /images/search
        if (! str_ends_with($requestUrl, '/images/search')) {
            $requestUrl = rtrim($requestUrl, '/') . '/images/search';
        }

        // Build query parameters
        $queryParams = [
            'q' => $query,
            'count' => $count,
            'offset' => $offset,
        ];

        // Create Guzzle client configuration
        $clientConfig = [
            'base_uri' => $requestUrl,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            'headers' => [
                'Ocp-Apim-Subscription-Key' => $subscriptionKey,
            ],
        ];

        $attempt = 0;
        $maxAttempts = 2; // Original request + 1 retry

        while ($attempt < $maxAttempts) {
            try {
                // If this is a retry (second attempt), disable SSL verification
                if ($attempt !== 0) {
                    $clientConfig['verify'] = false;
                    $this->logger->warning('Retrying Bing Image Search request with SSL verification disabled', [
                        'endpoint' => $requestUrl,
                        'attempt' => $attempt + 1,
                    ]);
                }

                $client = new Client($clientConfig);

                // Send GET request
                $response = $client->request('GET', '', [
                    'query' => $queryParams,
                ]);

                // Get response body content
                $body = $response->getBody()->getContents();

                // Request successful, return data
                return Json::decode($body);
            } catch (RequestException $e) {
                // If there is a response, it's an HTTP error (4xx, 5xx, etc.), don't retry
                if ($e->hasResponse()) {
                    $statusCode = $e->getResponse()?->getStatusCode();
                    $reason = $e->getResponse()?->getReasonPhrase();
                    $responseBody = $e->getResponse()?->getBody()->getContents();
                    $this->logger->error(sprintf('Bing Image Search error HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                        'endpoint' => $requestUrl,
                        'statusCode' => $statusCode,
                    ]);
                    break; // HTTP error, don't retry, break out of loop
                }
                $this->logger->warning('Bing Image Search network error occurred', [
                    'endpoint' => $requestUrl,
                    'error' => $e->getMessage(),
                    'exception' => get_class($e),
                ]);

                ++$attempt;
            }
        }

        // If we get here, all attempts failed
        throw new RuntimeException('Bing Image Search error.');
    }
}
