<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Symfony\Component\DomCrawler\Crawler;

class DuckDuckGoSearch
{
    /**
     * Execute DuckDuckGo search with comprehensive parameters.
     *
     * WARNING: DuckDuckGo Lite API does NOT support true pagination.
     * The offset/count parameters only slice the results from a SINGLE API call.
     * This means offset pagination beyond the first page won't work as expected.
     *
     * @param string $query Search query
     * @param string $mkt Market code (e.g., zh-CN, en-US) - mapped to region
     * @param int $count Number of results (applied via manual slicing, limited by API response)
     * @param int $offset Pagination offset (WARNING: only works within single API response)
     * @param string $safeSearch Safe search level - DuckDuckGo always uses safe search
     * @param string $freshness Time filter (Day/Week/Month) - mapped to time parameter
     * @param string $setLang UI language code - not directly supported
     * @param null|string $region Legacy region parameter for backward compatibility
     * @param null|string $time Legacy time parameter for backward compatibility
     * @return array Search results
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $mkt = '',
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = '',
        ?string $region = null,
        ?string $time = null
    ): array {
        $form_params = [
            'q' => $query,
        ];

        // Use legacy parameters if provided, otherwise use new unified parameters
        if ($region !== null) {
            $form_params['kl'] = $region;
        } elseif (! empty($mkt)) {
            // Map mkt to DuckDuckGo region (e.g., zh-CN -> cn-zh)
            $form_params['kl'] = $this->mapMktToRegion($mkt);
        }

        if ($time !== null) {
            $form_params['t'] = $time;
        } elseif (! empty($freshness)) {
            // Map freshness to time parameter
            $form_params['t'] = $this->mapFreshnessToTime($freshness);
        }

        $client = new Client(['verify' => false]);
        $response = $client->post('https://lite.duckduckgo.com/lite/', [
            'form_params' => $form_params,
            'headers' => [
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
        ]);
        $content = $response->getBody()->getContents();

        $crawler = new Crawler($content);

        $weblinks = $crawler->filter('table:nth-child(5) .result-link');
        $webSnippets = $crawler->filter('table:nth-child(5) .result-snippet');

        $results = $weblinks->each(function (Crawler $node, $i) use ($webSnippets) {
            return [
                'title' => $node->html(),
                'url' => $node->attr('href'),
                'body' => trim($webSnippets->eq($i)->text()),
            ];
        });

        // Note: DuckDuckGo Lite API doesn't support native pagination
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

    /**
     * Map market code (mkt) to DuckDuckGo region code.
     * Examples: zh-CN -> cn-zh, en-US -> us-en.
     */
    private function mapMktToRegion(string $mkt): string
    {
        if (empty($mkt)) {
            return 'wt-wt'; // worldwide
        }

        // Simple mapping: zh-CN -> cn-zh
        $parts = explode('-', $mkt);
        if (count($parts) === 2) {
            return strtolower($parts[1]) . '-' . strtolower($parts[0]);
        }

        return $mkt;
    }

    /**
     * Map freshness to DuckDuckGo time parameter.
     * Freshness: Day/Week/Month -> Time: d/w/m.
     */
    private function mapFreshnessToTime(string $freshness): string
    {
        return match (strtolower($freshness)) {
            'day' => 'd',
            'week' => 'w',
            'month' => 'm',
            default => '',
        };
    }
}
