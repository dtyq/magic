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

class CloudswayImageSearch
{
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 30;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Execute Cloudsway image search.
     *
     * @param string $query Search query
     * @param string $apiKey Cloudsway API key (for Bearer token)
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $requestUrl Request URL
     * @param string $freshness Time filter (Week/Month)
     * @return array Native Cloudsway Image Search API response
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $apiKey,
        int $count = 10,
        int $offset = 0,
        string $requestUrl = '',
        string $freshness = ''
    ): array {
        if (empty($requestUrl)) {
            throw new RuntimeException('Cloudsway Image Search endpoint is not configured');
        }

        // Build query parameters
        $queryParams = [
            'q' => $query,
            'count' => $count,
            'offset' => $offset,
        ];

        // Add optional freshness parameter
        if (! empty($freshness)) {
            $queryParams['freshness'] = $freshness;
        }

        // Create Guzzle client configuration with Authorization Bearer header
        $clientConfig = [
            'base_uri' => $requestUrl,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
            ],
        ];

        $attempt = 0;
        $maxAttempts = 2; // Original request + 1 retry

        while ($attempt < $maxAttempts) {
            try {
                // If this is a retry (second attempt), disable SSL verification
                if ($attempt !== 0) {
                    $clientConfig['verify'] = false;
                    $this->logger->warning('Retrying Cloudsway Image Search request with SSL verification disabled', [
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
                    $this->logger->error(sprintf('Cloudsway Image Search error HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                        'endpoint' => $requestUrl,
                        'statusCode' => $statusCode,
                    ]);
                    break; // HTTP error, don't retry, break out of loop
                }
                $this->logger->warning('Cloudsway Image Search network error occurred', [
                    'endpoint' => $requestUrl,
                    'error' => $e->getMessage(),
                    'exception' => get_class($e),
                ]);

                ++$attempt;
            }
        }

        // If we get here, all attempts failed
        throw new RuntimeException('Cloudsway Image Search error.');
    }
}
