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
     * @throws GuzzleException
     */
    public function search(string $query, ?string $region = null, ?string $time = null): array
    {
        $form_params = [
            'q' => $query,
        ];
        $region !== null && $form_params['kl'] = $region;
        $time !== null && $form_params['t'] = $time;

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

        return $weblinks->each(function (Crawler $node, $i) use ($webSnippets) {
            return [
                'title' => $node->html(),
                'url' => $node->attr('href'),
                'body' => trim($webSnippets->eq($i)->text()),
            ];
        });
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
