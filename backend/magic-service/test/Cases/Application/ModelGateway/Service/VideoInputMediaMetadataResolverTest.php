<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\Video\VideoInputMediaMetadataResolver;
use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use PHPUnit\Framework\TestCase;
use Psr\SimpleCache\CacheInterface;
use ReflectionMethod;
use ReflectionNamedType;

/**
 * @internal
 */
class VideoInputMediaMetadataResolverTest extends TestCase
{
    public function testResolverAndAppServiceReturnArrayMetadata(): void
    {
        $resolverReturnType = (new ReflectionMethod(VideoInputMediaMetadataResolver::class, 'resolve'))->getReturnType();
        $appServiceReturnType = (new ReflectionMethod(VideoOperationAppService::class, 'resolveEstimateInputMetadata'))->getReturnType();

        $this->assertInstanceOf(ReflectionNamedType::class, $resolverReturnType);
        $this->assertSame('array', $resolverReturnType->getName());
        $this->assertInstanceOf(ReflectionNamedType::class, $appServiceReturnType);
        $this->assertSame('array', $appServiceReturnType->getName());
    }

    /**
     * provider 素材引用（asset://）没有可下载的媒体实体，按默认时长兜底计入，且不触发任何探测。
     */
    public function testResolveFallsBackToDefaultDurationForProviderAssetUri(): void
    {
        $probe = $this->createMock(VideoMediaProbeInterface::class);
        $probe->expects($this->never())->method('probe');
        $taskFileDomainService = $this->createTaskFileDomainService();
        $taskFileDomainService->expects($this->never())->method('findEntityByRelativePath');

        $metadata = $this->createResolver($taskFileDomainService, $probe)->resolve(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            1,
            [
                ['uri' => 'asset://958159588452237313'],
            ],
        );

        $this->assertSame(15, $metadata['total_duration_seconds']);
        $this->assertSame(1, $metadata['reference_video_count']);
    }

    /**
     * 多个 provider 素材引用按个数累计兜底时长，保证 has_reference_video 与计费秒数都不落空。
     */
    public function testResolveAccumulatesFallbackDurationPerProviderAssetUri(): void
    {
        $metadata = $this->createResolver(
            $this->createTaskFileDomainService(),
            $this->createMock(VideoMediaProbeInterface::class),
        )->resolve(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            1,
            [
                ['uri' => 'asset://958159588452237313'],
                ['uri' => 'asset://958159588452237314'],
            ],
        );

        $this->assertSame(30, $metadata['total_duration_seconds']);
        $this->assertSame(2, $metadata['reference_video_count']);
    }

    private function createResolver(
        TaskFileDomainService $taskFileDomainService,
        VideoMediaProbeInterface $videoMediaProbe,
    ): VideoInputMediaMetadataResolver {
        return new VideoInputMediaMetadataResolver(
            $taskFileDomainService,
            // FileDomainService 是 readonly，无法直接 double，改为注入 mock 的仓储构造真实实例。
            new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)),
            $videoMediaProbe,
            $this->createMock(CacheInterface::class),
        );
    }

    private function createTaskFileDomainService(): TaskFileDomainService
    {
        return $this->getMockBuilder(TaskFileDomainService::class)
            ->disableOriginalConstructor()
            ->getMock();
    }
}
