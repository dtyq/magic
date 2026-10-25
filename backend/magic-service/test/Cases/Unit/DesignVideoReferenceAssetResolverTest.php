<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Service\AssetAppService;
use App\Application\Design\Support\DesignVideoReferenceAssetResolver;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use Dtyq\CloudFile\Kernel\Struct\DownloadedRemoteFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 *
 * 仅在无网络、无 DB 的兜底分支上做断言：asset:// 直接保留、找不到工作区文件时退回原始 uri。
 * 真正触发下载与第三方同步的分支需要沙箱网络，留给集成测试覆盖。
 */
final class DesignVideoReferenceAssetResolverTest extends TestCase
{
    private TaskFileDomainService $taskFileDomainService;

    private FileDomainService $fileDomainService;

    private AssetAppService $assetAppService;

    private AssetDomainService $assetDomainService;

    private CloudFileRepositoryInterface $cloudFileRepository;

    private SafeRemoteFileDownloader $remoteFileDownloader;

    private DesignVideoReferenceAssetResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $this->cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $this->remoteFileDownloader = $this->createMock(SafeRemoteFileDownloader::class);
        // FileDomainService 是 readonly，无法直接 double，改为注入 mock 的仓储构造真实实例。
        $this->fileDomainService = new FileDomainService($this->cloudFileRepository);
        $this->assetAppService = $this->createMock(AssetAppService::class);
        $this->assetDomainService = $this->createMock(AssetDomainService::class);
        $this->resolver = new DesignVideoReferenceAssetResolver(
            $this->taskFileDomainService,
            $this->fileDomainService,
            $this->assetAppService,
            $this->assetDomainService,
            $this->remoteFileDownloader,
        );
    }

    public function testAssetUriIsPreservedWithoutWorkspaceLookup(): void
    {
        $entity = $this->buildEntity(
            ['reference_images' => [['uri' => 'asset://42']]],
            ['reference_images' => [['uri' => 'asset://42']]],
        );

        // asset:// 不应触发任何工作区/资产查询。
        $this->taskFileDomainService->expects($this->never())->method('findEntityByRelativePath');
        $this->assetDomainService->expects($this->never())->method('findPassedProviderAssetByContentHash');

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('asset://42', $entity->getInputPayload()['reference_images'][0]['uri']);
        self::assertSame('asset://42', $entity->getRequestPayload()['inputs']['reference_images'][0]['uri']);
    }

    public function testUnresolvableWorkspacePathFallsBackToOriginalUri(): void
    {
        $entity = $this->buildEntity(
            ['reference_videos' => [['uri' => 'project/a/video.mp4']]],
            ['reference_videos' => [['uri' => 'project/a/video.mp4']]],
        );

        $this->taskFileDomainService
            ->method('findEntityByRelativePath')
            ->willReturn(null);
        $this->assetDomainService->expects($this->never())->method('findPassedProviderAssetByContentHash');

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('project/a/video.mp4', $entity->getInputPayload()['reference_videos'][0]['uri']);
        self::assertSame('project/a/video.mp4', $entity->getRequestPayload()['inputs']['reference_videos'][0]['uri']);
    }

    public function testResolvedFileWithoutLinkFallsBackToOriginalUri(): void
    {
        $fileEntity = $this->createMock(TaskFileEntity::class);
        $fileEntity->method('getFileKey')->willReturn('org/open/abc/video.mp4');
        $fileEntity->method('getFileName')->willReturn('video.mp4');

        $entity = $this->buildEntity(
            ['reference_audios' => [['uri' => 'project/a/audio.wav']]],
            ['reference_audios' => [['uri' => 'project/a/audio.wav']]],
        );

        $this->taskFileDomainService->method('findEntityByRelativePath')->willReturn($fileEntity);
        // 拿不到可访问链接时退回原 uri，不下载、不建资产。
        $this->cloudFileRepository->method('getLinks')->willReturn([]);
        $this->assetDomainService->expects($this->never())->method('findPassedProviderAssetByContentHash');

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('project/a/audio.wav', $entity->getInputPayload()['reference_audios'][0]['uri']);
    }

    public function testResolverDoesNotInjectMissingReferenceKeys(): void
    {
        // 原始 payload 只有 reference_images，材质化后不应补出空数组的其它 key。
        $entity = $this->buildEntity(
            ['reference_images' => [['uri' => 'asset://7']]],
            ['reference_images' => [['uri' => 'asset://7']]],
        );
        $entity->setRequestPayload(['inputs' => $entity->getRequestPayload()['inputs'], 'generation' => 'gen-1']);

        $this->resolver->resolve($this->dataIsolation(), $entity);

        $inputKeys = array_keys($entity->getInputPayload());
        self::assertSame(['reference_images'], $inputKeys);

        $requestKeys = array_keys($entity->getRequestPayload());
        self::assertContains('inputs', $requestKeys);
        self::assertContains('generation', $requestKeys);
        self::assertArrayNotHasKey('reference_videos', $entity->getInputPayload());
        self::assertArrayNotHasKey('reference_videos', $entity->getRequestPayload()['inputs']);
    }

    /**
     * 用真实 generate-video 请求结构（图片×2 + 视频×1）驱动 resolver：
     * 验证双 payload 同步改写、结构不被污染；本地无真实任务文件映射时全部退回原始 uri。
     */
    public function testResolveWithRealisticGenerateVideoPayload(): void
    {
        $inputs = [
            'reference_images' => [
                ['uri' => '/天仙游泳视频/images/可爱橘猫_26f0d629e97d_20260910115145.jpg'],
                ['uri' => '/天仙游泳视频/images/庞大天宫与浩瀚天空_99f7988b513c_20260910111800.jpg'],
            ],
            'reference_videos' => [
                ['uri' => '/天仙游泳视频/videos/生成天山飞仙_20260909225125.mp4'],
            ],
        ];

        $entity = $this->buildEntity($inputs, $inputs);
        $entity->setRequestPayload([
            'inputs' => $entity->getRequestPayload()['inputs'],
            'generation' => ['aspect_ratio' => '16:9'],
        ]);

        // 本地无真实任务文件映射 → 全部退回原始 uri，且不补出 reference_audios/frames。
        $this->taskFileDomainService->method('findEntityByRelativePath')->willReturn(null);

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame($inputs, $entity->getInputPayload());
        self::assertSame($inputs, $entity->getRequestPayload()['inputs']);
        self::assertArrayNotHasKey('reference_audios', $entity->getInputPayload());
        self::assertArrayNotHasKey('frames', $entity->getInputPayload());
    }

    /**
     * 用真实 generate-video payload 作「path => asset」数组映射，验证 workspace 引用被改写成 asset://<id>。
     * 下载器与文件链接均注入桩以跳过真实网络；命中本人已有素材即复用，不触发上传/新建。
     */
    public function testResolveMapsWorkspacePathsToAssetUris(): void
    {
        $inputs = [
            'reference_images' => [
                ['uri' => '/天仙游泳视频/images/可爱橘猫_26f0d629e97d_20260910115145.jpg'],
                ['uri' => '/天仙游泳视频/images/庞大天宫与浩瀚天空_99f7988b513c_20260910111800.jpg'],
            ],
            'reference_videos' => [
                ['uri' => '/天仙游泳视频/videos/生成天山飞仙_20260909225125.mp4'],
            ],
        ];
        $entity = $this->buildEntity($inputs, $inputs);

        // 每个引用都解析到同一个文件实体与可访问链接。
        $fileEntity = $this->createMock(TaskFileEntity::class);
        $fileEntity->method('getFileKey')->willReturn('org/open/key');
        $fileEntity->method('getFileName')->willReturn('name');
        $this->taskFileDomainService->method('findEntityByRelativePath')->willReturn($fileEntity);
        $this->cloudFileRepository->method('getLinks')->willReturn([
            'org/open/key' => new FileLink('org/open/key', 'https://example.com/file', 0),
        ]);

        // 注入下载器桩：每次返回独立本地临时文件，使 hash_file 可真实计算（finally 各自清理）。
        $this->remoteFileDownloader->method('download')->willReturnCallback(static function (): DownloadedRemoteFile {
            $tmp = tempnam(sys_get_temp_dir(), 'asset-');
            file_put_contents($tmp, 'binary-content');
            return new DownloadedRemoteFile($tmp, 'name', 'application/octet-stream', (int) filesize($tmp));
        });

        // 命中已审核通过的同内容凭证：所有引用内容被复用为同一资产（path => asset://1001），不触发上传/新建。
        $this->assetDomainService->method('findPassedProviderAssetByContentHash')
            ->willReturn($this->passedProviderAsset('1001'));
        $this->assetAppService->expects($this->never())->method('createPersonalAsset');

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('asset://1001', $entity->getInputPayload()['reference_images'][0]['uri']);
        self::assertSame('asset://1001', $entity->getInputPayload()['reference_images'][1]['uri']);
        self::assertSame('asset://1001', $entity->getInputPayload()['reference_videos'][0]['uri']);
        self::assertSame($entity->getInputPayload(), $entity->getRequestPayload()['inputs']);
    }

    /**
     * 同一份文件在 inputPayload 与 requestPayload 各引用一次时，本请求内只解析一次。
     * 验证下载/查重不再重复发生（命中缓存直接复用 asset://），避免冗余的网络与上传。
     */
    public function testUniqueUriIsResolvedOnlyOnceAcrossPayloads(): void
    {
        $uris = [
            '/天仙游泳视频/images/可爱橘猫_26f0d629e97d_20260910115145.jpg',
            '/天仙游泳视频/images/庞大天宫与浩瀚天空_99f7988b513c_20260910111800.jpg',
            '/天仙游泳视频/videos/生成天山飞仙_20260909225125.mp4',
        ];
        $inputs = [
            'reference_images' => [['uri' => $uris[0]], ['uri' => $uris[1]]],
            'reference_videos' => [['uri' => $uris[2]]],
        ];
        // 同一份文件在两个 payload 里各出现一次 → 共 6 处引用，但去重后只应解析 3 次。
        $entity = $this->buildEntity($inputs, $inputs);

        $fileEntity = $this->createMock(TaskFileEntity::class);
        $fileEntity->method('getFileKey')->willReturn('org/open/key');
        $fileEntity->method('getFileName')->willReturn('name');
        $this->taskFileDomainService->method('findEntityByRelativePath')->willReturn($fileEntity);
        $this->cloudFileRepository->method('getLinks')->willReturn([
            'org/open/key' => new FileLink('org/open/key', 'https://example.com/file', 0),
        ]);
        $this->remoteFileDownloader->method('download')->willReturnCallback(static function (): DownloadedRemoteFile {
            $tmp = tempnam(sys_get_temp_dir(), 'asset-');
            file_put_contents($tmp, 'binary-content');
            return new DownloadedRemoteFile($tmp, 'name', 'application/octet-stream', (int) filesize($tmp));
        });
        $this->assetDomainService->method('findPassedProviderAssetByContentHash')
            ->willReturn($this->passedProviderAsset('1001'));

        // 三个不同 uri 各解析一次；inputPayload 与 requestPayload 的重复引用命中缓存，不再触发下载/查重。
        $this->remoteFileDownloader->expects($this->exactly(3))->method('download');
        $this->assetDomainService->expects($this->exactly(3))->method('findPassedProviderAssetByContentHash');

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('asset://1001', $entity->getInputPayload()['reference_videos'][0]['uri']);
        self::assertSame('asset://1001', $entity->getRequestPayload()['inputs']['reference_videos'][0]['uri']);
    }

    /**
     * 上传私有桶时必须保留文件扩展名：下载器落地的是无后缀的临时文件，
     * 只传 realPath 会让 key 丢后缀、asset_media_type 推断失败，火山会把视频/音频当图片处理。
     */
    public function testMaterializedUploadKeepsFileExtension(): void
    {
        $uri = '/天仙游泳视频/videos/生成天山飞仙_20260909225125.mp4';
        $entity = $this->buildEntity(
            ['reference_videos' => [['uri' => $uri]]],
            ['reference_videos' => [['uri' => $uri]]],
        );

        $fileEntity = $this->createMock(TaskFileEntity::class);
        $fileEntity->method('getFileKey')->willReturn('org/open/key');
        $fileEntity->method('getFileName')->willReturn('生成天山飞仙_20260909225125.mp4');
        $this->taskFileDomainService->method('findEntityByRelativePath')->willReturn($fileEntity);
        $this->cloudFileRepository->method('getLinks')->willReturn([
            'org/open/key' => new FileLink('org/open/key', 'https://example.com/file', 0),
        ]);

        // 下载器落地无扩展名临时文件（同生产 tempnam），真实文件名只在 name 里。
        $this->remoteFileDownloader->method('download')->willReturnCallback(static function (): DownloadedRemoteFile {
            $tmp = tempnam(sys_get_temp_dir(), 'cloud-file-tmp-');
            file_put_contents($tmp, 'binary-content');
            return new DownloadedRemoteFile($tmp, '生成天山飞仙_20260909225125.mp4', 'video/mp4', (int) filesize($tmp));
        });

        // 未命中已有素材、取不到第三方 ID 时走上传 + 新建分支。
        $this->assetDomainService->method('findPassedProviderAssetByContentHash')->willReturn(null);
        $this->assetAppService->method('createPersonalAsset')->willReturn(new AssetEntity(['id' => 2002]));
        $this->assetDomainService->method('findProviderAsset')
            ->willReturn($this->passedProviderAsset('prov-2002'));

        $uploadedName = null;
        $this->cloudFileRepository->expects($this->once())->method('uploadByCredential')->willReturnCallback(
            static function (string $organizationCode, UploadFile $file) use (&$uploadedName): void {
                $uploadedName = $file->getName();
                $file->setKey('org/private/key/' . $file->getName());
            }
        );

        $this->resolver->resolve($this->dataIsolation(), $entity);

        self::assertSame('mp4', pathinfo((string) $uploadedName, PATHINFO_EXTENSION));
        self::assertSame('asset://prov-2002', $entity->getInputPayload()['reference_videos'][0]['uri']);
    }

    /**
     * 构造一条已通过审核的第三方映射，作为复用命中的返回值。
     */
    private function passedProviderAsset(string $providerAssetId): ProviderAssetEntity
    {
        return new ProviderAssetEntity([
            'asset_id' => 1001,
            'provider_code' => 'VolcengineArk',
            'project_name' => 'project',
            'provider_asset_id' => $providerAssetId,
            'provider_status' => ProviderAssetStatus::PASS->value,
        ]);
    }

    private function buildEntity(array $inputPayload, array $requestInputs): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setProjectId(1);
        $entity->setInputPayload($inputPayload);
        $entity->setRequestPayload(['inputs' => $requestInputs]);
        return $entity;
    }

    private function dataIsolation(): DesignDataIsolation
    {
        return DesignDataIsolation::create('org-1', 'user-1', 'magic-1');
    }
}
