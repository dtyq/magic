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

class SerpApiImageSearch
{
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 30;

    private const string DEFAULT_SERPAPI_ENDPOINT = 'https://serpapi.com/search';

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Execute SerpApi image search (Google Images).
     *
     * @param string $query Search query
     * @param string $apiKey SerpApi API key
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $requestUrl Request URL (defaults to https://serpapi.com/search)
     * @return array Native SerpApi response
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $apiKey,
        int $count = 10,
        int $offset = 0,
        string $requestUrl = ''
    ): array {
        if (empty($requestUrl)) {
            $requestUrl = self::DEFAULT_SERPAPI_ENDPOINT;
        }

        // Build query parameters for SerpApi Google Images
        $queryParams = [
            'engine' => 'google_images',
            'q' => $query,
            'num' => $count,
            'start' => $offset,
            'api_key' => $apiKey,
        ];

        // Create Guzzle client configuration
        $clientConfig = [
            'base_uri' => $requestUrl,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
        ];

        $attempt = 0;
        $maxAttempts = 2; // Original request + 1 retry

        while ($attempt < $maxAttempts) {
            try {
                // If this is a retry (second attempt), disable SSL verification
                if ($attempt !== 0) {
                    $clientConfig['verify'] = false;
                    $this->logger->warning('Retrying SerpApi request with SSL verification disabled', [
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
                    $this->logger->error(sprintf('SerpApi error HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                        'endpoint' => $requestUrl,
                        'statusCode' => $statusCode,
                    ]);
                    break; // HTTP error, don't retry, break out of loop
                }
                $this->logger->warning('SerpApi network error occurred', [
                    'endpoint' => $requestUrl,
                    'error' => $e->getMessage(),
                    'exception' => get_class($e),
                ]);

                ++$attempt;
            }
        }

        // If we get here, all attempts failed
        throw new RuntimeException('SerpApi Image Search error.');
    }
}
