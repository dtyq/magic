<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\File\Rpc\Service;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Interfaces\File\Rpc\Service\FileRpcService;
use Closure;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use stdClass;

readonly class StubFileDomainService extends FileDomainService
{
    /**
     * @param Closure(string, ?string, ?StorageBucketType, array, array): ?FileLink $getLinkHandler
     * @param Closure(array, string): array $getMetasHandler
     */
    public function __construct(
        private Closure $getLinkHandler,
        private Closure $getMetasHandler,
    ) {
    }

    public function getLink(
        string $organizationCode,
        ?string $filePath,
        ?StorageBucketType $bucketType = null,
        array $downloadNames = [],
        array $options = []
    ): ?FileLink {
        $handler = $this->getLinkHandler;
        return $handler($organizationCode, $filePath, $bucketType, $downloadNames, $options);
    }

    public function getMetas(array $paths, string $organizationCode): array
    {
        $handler = $this->getMetasHandler;
        return $handler($paths, $organizationCode);
    }
}

/**
 * @internal
 */
class FileRpcServiceTest extends TestCase
{
    public function testGetLinkShouldNormalizeUrlPath(): void
    {
        $service = new FileRpcService(
            new StubFileDomainService(
                function (string $organizationCode, ?string $filePath, ?StorageBucketType $bucketType): ?FileLink {
                    $this->assertSame('DT001', $organizationCode);
                    $this->assertSame('DT001/open/abc/demo.md', $filePath);
                    $this->assertSame(StorageBucketType::Private, $bucketType);

                    return new FileLink('DT001/open/abc/demo.md', 'https://example.com/signed', 3600);
                },
                fn (): array => []
            ),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->getLink([
            'organization_code' => 'DT001',
            'file_path' => 'https://example.com/DT001/open/abc/demo.md?sign=1',
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('https://example.com/signed', $result['data']['url']);
    }

    public function testGetLinkShouldReturn400WhenMissingParams(): void
    {
        $service = new FileRpcService(
            new StubFileDomainService(
                fn (): ?FileLink => null,
                fn (): array => []
            ),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->getLink([
            'organization_code' => '',
            'file_path' => '',
        ]);

        $this->assertSame(400, $result['code']);
    }

    public function testStatShouldReturn404WhenNotFound(): void
    {
        $service = new FileRpcService(
            new StubFileDomainService(
                fn (): ?FileLink => null,
                function (array $paths, string $organizationCode): array {
                    $this->assertSame(['DT001/open/abc/demo.md'], $paths);
                    $this->assertSame('DT001', $organizationCode);
                    return [];
                }
            ),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->stat([
            'organization_code' => 'DT001',
            'file_path' => 'DT001/open/abc/demo.md',
        ]);

        $this->assertSame(404, $result['code']);
    }

    public function testStatShouldReturnSuccessWhenExists(): void
    {
        $service = new FileRpcService(
            new StubFileDomainService(
                fn (): ?FileLink => null,
                fn (): array => ['DT001/open/abc/demo.md' => new stdClass()]
            ),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->stat([
            'organization_code' => 'DT001',
            'file_path' => 'DT001/open/abc/demo.md',
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertTrue($result['data']['exists']);
    }

    public function testGetLinkShouldReturn500WhenExceptionThrown(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())->method('error');

        $service = new FileRpcService(
            new StubFileDomainService(
                fn (): ?FileLink => throw new RuntimeException('boom'),
                fn (): array => []
            ),
            $logger
        );

        $result = $service->getLink([
            'organization_code' => 'DT001',
            'file_path' => 'DT001/open/abc/demo.md',
        ]);

        $this->assertSame(500, $result['code']);
    }
}
