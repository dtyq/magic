<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\MagicFS\Rpc\Service;

use App\Application\Authentication\Service\AuthSandboxAppService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\MagicFS\Rpc\Service\MagicFSFileAccessCache;
use App\Interfaces\MagicFS\Rpc\Service\MagicFSFileRpcService;
use Dtyq\SuperMagic\Application\MagicFS\Service\MagicFSFileAppService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * @internal
 */
class MagicFSFileRpcServiceTest extends TestCase
{
    public function testAuthorizeFileViewerWritesCacheOnlyAfterPermissionPassed(): void
    {
        $authorization = $this->authorization();
        $authService = $this->createMock(AuthSandboxAppService::class);
        $authService->expects($this->once())
            ->method('authenticate')
            ->willReturn($authorization);

        $magicFSFileAppService = $this->createMock(MagicFSFileAppService::class);
        $magicFSFileAppService->expects($this->once())
            ->method('assertFileViewerAccessible')
            ->with($authorization, '42');

        $cache = $this->createMock(MagicFSFileAccessCache::class);
        $cache->expects($this->once())
            ->method('has')
            ->with($this->stringStartsWith('magicfs:file_access:v1:'))
            ->willReturn(false);
        $cache->expects($this->once())
            ->method('put')
            ->with($this->stringStartsWith('magicfs:file_access:v1:'), 10);

        $service = new MagicFSFileRpcService(
            $authService,
            $magicFSFileAppService,
            $cache,
            $this->createMock(LoggerInterface::class),
        );

        $result = $service->authorizeFileViewer([
            'headers' => ['authorization' => ['Bearer token']],
            'file_id' => '42',
        ]);

        $this->assertSame(0, $result['code']);
    }

    public function testAuthorizeFileViewerCacheHitSkipsPermissionCheck(): void
    {
        $authService = $this->createMock(AuthSandboxAppService::class);
        $authService->expects($this->once())
            ->method('authenticate')
            ->willReturn($this->authorization());

        $magicFSFileAppService = $this->createMock(MagicFSFileAppService::class);
        $magicFSFileAppService->expects($this->never())
            ->method('assertFileViewerAccessible');

        $cache = $this->createMock(MagicFSFileAccessCache::class);
        $cache->expects($this->once())
            ->method('has')
            ->willReturn(true);
        $cache->expects($this->never())
            ->method('put');

        $service = new MagicFSFileRpcService(
            $authService,
            $magicFSFileAppService,
            $cache,
            $this->createMock(LoggerInterface::class),
        );

        $result = $service->authorizeFileViewer(['file_id' => '42']);

        $this->assertSame(0, $result['code']);
    }

    public function testAuthorizeFileViewerDoesNotCachePermissionFailure(): void
    {
        $authService = $this->createMock(AuthSandboxAppService::class);
        $authService->expects($this->once())
            ->method('authenticate')
            ->willReturn($this->authorization());

        $magicFSFileAppService = $this->createMock(MagicFSFileAppService::class);
        $magicFSFileAppService->expects($this->once())
            ->method('assertFileViewerAccessible')
            ->willThrowException(new BusinessException('project.project_access_denied', 42003));

        $cache = $this->createMock(MagicFSFileAccessCache::class);
        $cache->expects($this->once())
            ->method('has')
            ->willReturn(false);
        $cache->expects($this->never())
            ->method('put');

        $service = new MagicFSFileRpcService(
            $authService,
            $magicFSFileAppService,
            $cache,
            $this->createMock(LoggerInterface::class),
        );

        $result = $service->authorizeFileViewer(['file_id' => '42']);

        $this->assertSame(42003, $result['code']);
        $this->assertSame('project.project_access_denied', $result['message']);
    }

    public function testAuthorizeFileViewerDoesNotCacheUnexpectedException(): void
    {
        $authService = $this->createMock(AuthSandboxAppService::class);
        $authService->expects($this->once())
            ->method('authenticate')
            ->willReturn($this->authorization());

        $magicFSFileAppService = $this->createMock(MagicFSFileAppService::class);
        $magicFSFileAppService->expects($this->once())
            ->method('assertFileViewerAccessible')
            ->willThrowException(new RuntimeException('rpc failed'));

        $cache = $this->createMock(MagicFSFileAccessCache::class);
        $cache->expects($this->once())
            ->method('has')
            ->willReturn(false);
        $cache->expects($this->never())
            ->method('put');

        $service = new MagicFSFileRpcService(
            $authService,
            $magicFSFileAppService,
            $cache,
            $this->createMock(LoggerInterface::class),
        );

        $result = $service->authorizeFileViewer(['file_id' => '42']);

        $this->assertSame(5000, $result['code']);
        $this->assertSame('system_exception', $result['message']);
    }

    private function authorization(): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId('user-1');
        $authorization->setOrganizationCode('org-1');
        return $authorization;
    }
}
