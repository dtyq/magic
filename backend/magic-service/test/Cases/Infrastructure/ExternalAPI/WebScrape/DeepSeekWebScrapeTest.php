<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\WebScrape;

use App\Infrastructure\ExternalAPI\WebScrape\AbstractWebScrape;
use App\Infrastructure\ExternalAPI\WebScrape\DeepSeekWebScrape;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\WebScrape\DeepSeekWebScrape
 */
final class DeepSeekWebScrapeTest extends TestCase
{
    public function testUnsupportedFormatsAreNormalizedToMarkdown(): void
    {
        $mock = new MockHandler([
            $this->successResponse('DeepSeek content'),
        ]);
        $webScrape = $this->createWebScrape($mock);

        $response = $webScrape->scrape(
            'https://example.com/article',
            ['HTML'],
            'quality'
        );

        self::assertSame(['MARKDOWN'], $response->getFormats());
        self::assertSame([
            'markdown' => 'DeepSeek content',
            'site_name' => '',
            'logo' => null,
            'image_list' => [],
        ], $response->getContent());
        self::assertSame(0, $mock->count());
    }

    public function testEmptyFormatsAreAcceptedAndNormalizedToMarkdown(): void
    {
        $mock = new MockHandler([
            $this->successResponse('DeepSeek content'),
        ]);
        $webScrape = $this->createWebScrape($mock);

        $response = $webScrape->scrape(
            'https://example.com/article',
            [],
            'quality'
        );

        self::assertSame(['MARKDOWN'], $response->getFormats());
        self::assertSame('DeepSeek content', $response->getContent()['markdown']);
    }

    public function testTransientFailureIsRetriedOnce(): void
    {
        $mock = new MockHandler([
            new Response(500),
            $this->successResponse('Recovered content'),
        ]);
        $webScrape = $this->createWebScrape($mock);

        $response = $webScrape->scrape(
            'https://example.com/article',
            ['MARKDOWN'],
            'quality'
        );

        self::assertSame('Recovered content', $response->getContent()['markdown']);
        self::assertSame(0, $mock->count());
    }

    public function testAuthenticationFailureIsNotRetried(): void
    {
        $mock = new MockHandler([
            new Response(401),
            $this->successResponse('Must not be requested'),
        ]);
        $webScrape = $this->createWebScrape($mock);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('DeepSeek WebScrape error');

        try {
            $webScrape->scrape(
                'https://example.com/article',
                ['MARKDOWN'],
                'quality'
            );
        } finally {
            self::assertSame(1, $mock->count());
        }
    }

    private function createWebScrape(MockHandler $mock): DeepSeekWebScrape
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        $webScrape = new DeepSeekWebScrape($loggerFactory);
        $webScrape->configure([
            'request_url' => 'https://api.deepseek.com/v1/tools/fetch',
            'api_key' => 'test-key',
        ]);

        $httpClient = new Client([
            'handler' => HandlerStack::create($mock),
        ]);
        $property = (new ReflectionClass(AbstractWebScrape::class))->getProperty('httpClient');
        $property->setValue($webScrape, $httpClient);

        return $webScrape;
    }

    private function successResponse(string $content): Response
    {
        return new Response(
            200,
            ['Content-Type' => 'application/json'],
            json_encode(['content' => $content], JSON_THROW_ON_ERROR)
        );
    }
}
