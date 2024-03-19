<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Symfony\Component\DomCrawler\Crawler;

class JinaSearch
{
    /**
     * Execute Jina search with comprehensive parameters.
     *
     * WARNING: Jina Search API does NOT support true pagination.
     * The offset/count parameters only slice the results from a SINGLE API call.
     * This means offset pagination beyond the first page won't work as expected.
     *
     * @param string $query Search query
     * @param null|string $apiKey Jina API key (optional)
     * @param string $mkt Market code (e.g., zh-CN, en-US) - mapped to X-Locale header
     * @param int $count Number of results (applied via manual slicing, limited by API response)
     * @param int $offset Pagination offset (WARNING: only works within single API response)
     * @param string $safeSearch Safe search level - not directly supported by Jina
     * @param string $freshness Time filter - not directly supported by Jina
     * @param string $setLang UI language code - mapped to X-Locale header
     * @param null|string $region Legacy region parameter for backward compatibility
     * @return array Search results
     * @throws GuzzleException
     */
    public function search(
        string $query,
        ?string $apiKey = null,
        string $mkt = '',
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = '',
        ?string $region = null,
        string $requestUrl = ''
    ): array {
        $body = [
            'q' => $query,
        ];

        $header = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
        if (empty($requestUrl)) {
            $requestUrl = 'https://s.jina.ai/';
        }

        // Use legacy region parameter if provided, otherwise use new unified parameters
        if ($region !== null) {
            $header['X-Locale'] = $region;
        } elseif (! empty($mkt)) {
            $header['X-Locale'] = $mkt;
        } elseif (! empty($setLang)) {
            $header['X-Locale'] = $setLang;
        }

        if ($apiKey !== null) {
            $header['Authorization'] = 'Bearer ' . $apiKey;
        }

        $client = new Client(['verify' => false]);
        $response = $client->post($requestUrl, [
            'json' => $body,
            'headers' => $header,
        ]);

        $results = Json::decode($response->getBody()->getContents())['data'] ?? [];

        // Note: Jina Search API doesn't support native pagination parameters
        // We can only slice the results returned from a single request
        // This means offset pagination won't work properly beyond the first page
        // If offset > available results, this will return empty array
        return array_slice($results, $offset, $count);
    }

    /**
     * @throws GuzzleException
     */
    public function apiExtractText(string $url): array
    {
        $client = new Client(['verify' => false]);
        $response = $client->get($url);
        $content = $response->getBody()->getContents();

        $crawler = new Crawler($content);

        return [
            'title' => $crawler->filter('title')->text(),
            'url' => $url,
            'body' => $this->cleanText($crawler->filter('body')->text()),
        ];
    }

    /* @phpstan-ignore-next-line */
    private function cleanText(string $text): null|array|string
    {
        $text = trim($text);

        $text = preg_replace("/(\n){4,}/", "\n\n\n", $text);
        $text = preg_replace('/ {3,}/', ' ', $text);
        $text = preg_replace("/(\t)/", '', $text);
        return preg_replace("/\n+(\\s*\n)*/", "\n", $text);
    }
}
