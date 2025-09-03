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
     * @throws GuzzleException
     */
    public function search(string $query, ?string $apiKey, ?string $region = null): array
    {
        $body = [
            'q' => $query,
        ];

        $header = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
        $region !== null && $header['X-Locale'] = $region;
        $apiKey !== null && $header['Authorization'] = 'Bearer ' . $apiKey;

        $client = new Client(['verify' => false]);
        $response = $client->post('https://s.jina.ai/', [
            'json' => $body,
            'headers' => $header,
        ]);
        return Json::decode($response->getBody()->getContents())['data'] ?? [];
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
