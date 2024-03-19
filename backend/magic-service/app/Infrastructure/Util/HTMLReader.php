<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use GuzzleHttp\Client;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class HTMLReader
{
    private Client $client;

    public function __construct()
    {
        $this->client = new Client();
    }

    public function getText(string $url): string
    {
        try {
            $response = $this->client->get($url, [
                'headers' => [
                    'Content-Type' => 'application/x-www-form-urlencoded',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Encoding' => 'gzip, deflate',
                    'Accept-Language' => 'zh-CN,en-US;q=0.7,en;q=0.3',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ],
                'timeout' => 5,
                'verify' => false,
            ]);

            $content = $response->getBody()->getContents();
            $crawler = new Crawler($content);

            // 移除无关的标签
            $crawler->filter('style, script, iframe, noscript, head, meta, link, svg, path')->each(function (Crawler $node) {
                if ($node->getNode(0)?->parentNode) {
                    $node->getNode(0)->parentNode->removeChild($node->getNode(0));
                }
            });
            return $crawler->filter('body')->text();
        } catch (Throwable) {
            return '';
        }
    }
}
