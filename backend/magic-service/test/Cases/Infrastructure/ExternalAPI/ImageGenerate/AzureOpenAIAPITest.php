<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI\AzureOpenAIAPI;
use App\Infrastructure\Util\File\SecureImageDownloader;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI\AzureOpenAIAPI
 */
class AzureOpenAIAPITest extends TestCase
{
    public function testEditImageUsesSecureDownloaderAndSendsCompleteMultipartFields(): void
    {
        $logger = new AzureTestLogger();
        $client = $this->createMock(Client::class);
        $downloader = new AzureStubSecureImageDownloader();

        $imageTempFile = tempnam(sys_get_temp_dir(), 'azure-openai-image-');
        $imagePath = $imageTempFile . '.png';
        rename($imageTempFile, $imagePath);
        file_put_contents($imagePath, 'azure-image-binary');

        $maskTempFile = tempnam(sys_get_temp_dir(), 'azure-openai-mask-');
        $maskPath = $maskTempFile . '.png';
        rename($maskTempFile, $maskPath);
        file_put_contents($maskPath, 'azure-mask-binary');

        $downloader->downloads['https://example.com/source.png'] = ImageAsset::fromLocalFile(
            $imagePath,
            'image/png',
            size: strlen('azure-image-binary')
        );
        $downloader->downloads['https://example.com/mask.png'] = ImageAsset::fromLocalFile(
            $maskPath,
            'image/png',
            size: strlen('azure-mask-binary')
        );

        try {
            $client->expects($this->once())
                ->method('post')
                ->with(
                    'https://example.com/openai/deployments/demo/images/edits?api-version=2025-01-01',
                    $this->callback(function (array $options): bool {
                        $this->assertSame('test-api-key', $options['headers']['api-key'] ?? null);
                        $this->assertArrayNotHasKey('Content-Type', $options['headers'] ?? []);

                        $parts = $options['multipart'] ?? [];
                        $this->assertCount(6, $parts);

                        $this->assertSame('image', $parts[0]['name']);
                        $this->assertSame('source.png', $parts[0]['filename']);
                        $this->assertSame('image/png', $parts[0]['headers']['Content-Type'] ?? null);
                        $this->assertTrue(is_resource($parts[0]['contents']));
                        $this->assertSame('azure-image-binary', stream_get_contents($parts[0]['contents']));

                        $this->assertSame('mask', $parts[1]['name']);
                        $this->assertSame('mask.png', $parts[1]['filename']);
                        $this->assertSame('image/png', $parts[1]['headers']['Content-Type'] ?? null);
                        $this->assertTrue(is_resource($parts[1]['contents']));
                        $this->assertSame('azure-mask-binary', stream_get_contents($parts[1]['contents']));

                        $this->assertSame(['name' => 'prompt', 'contents' => '把两张图融合起来'], $parts[2]);
                        $this->assertSame(['name' => 'size', 'contents' => '1536x1024'], $parts[3]);
                        $this->assertSame(['name' => 'n', 'contents' => '2'], $parts[4]);
                        $this->assertSame(['name' => 'quality', 'contents' => 'high'], $parts[5]);

                        return true;
                    })
                )
                ->willReturn(new Response(200, [], json_encode([
                    'created' => 1,
                    'data' => [
                        ['b64_json' => 'abcd'],
                    ],
                ], JSON_UNESCAPED_UNICODE)));

            $api = new TestableAzureOpenAIAPI(
                'test-api-key',
                'https://example.com/openai/deployments/demo',
                '2025-01-01',
                $client,
                $downloader,
                $logger,
                'http://proxy.internal:8080'
            );

            $api->editImage(
                'test',
                ['https://example.com/source.png'],
                'https://example.com/mask.png',
                '把两张图融合起来',
                '1536x1024',
                2,
                'high'
            );

            $this->assertSame([
                [
                    'url' => 'https://example.com/source.png',
                    'check_header_mime_type' => false,
                    'proxy_url' => 'http://proxy.internal:8080',
                ],
                [
                    'url' => 'https://example.com/mask.png',
                    'check_header_mime_type' => false,
                    'proxy_url' => 'http://proxy.internal:8080',
                ],
            ], $downloader->calls);
        } finally {
            @unlink($imagePath);
            @unlink($maskPath);
        }
    }
}

final class TestableAzureOpenAIAPI extends AzureOpenAIAPI
{
    public function __construct(
        string $apiKey,
        string $baseUrl,
        string $apiVersion,
        private readonly Client $client,
        SecureImageDownloader $secureImageDownloader,
        AzureTestLogger $logger,
        ?string $proxyUrl = null,
    ) {
        parent::__construct($apiKey, $baseUrl, $apiVersion, $proxyUrl, $secureImageDownloader, $logger);
    }

    protected function createClient(): Client
    {
        return $this->client;
    }
}

final class AzureStubSecureImageDownloader extends SecureImageDownloader
{
    /**
     * @var array<string, ImageAsset>
     */
    public array $downloads = [];

    /**
     * @var array<int, array{url: string, check_header_mime_type: bool, proxy_url: null|string}>
     */
    public array $calls = [];

    public function __construct()
    {
    }

    public function download(
        string $imageUrl,
        array $blackList = [],
        bool $checkHeaderMimeType = true,
        ?string $proxyUrl = null,
    ): ImageAsset {
        $this->calls[] = [
            'url' => $imageUrl,
            'check_header_mime_type' => $checkHeaderMimeType,
            'proxy_url' => $proxyUrl,
        ];

        return $this->downloads[$imageUrl];
    }
}

final class AzureTestLogger extends AbstractLogger
{
    public function log($level, $message, array $context = []): void
    {
    }
}
