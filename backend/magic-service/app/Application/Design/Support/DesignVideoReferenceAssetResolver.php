<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Support;

use App\Application\Asset\Service\AssetAppService;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\File\Constant\FileUploadBusinessCode;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\File\ProviderAssetUri;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\RemoteDownloadSecurityConfig;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 将生成视频请求中的 workspace 素材引用转换为当前用户可复用的个人资产引用。
 *
 * 仅处理火山方舟视频生成使用的 reference_images、reference_videos、reference_audios 和 frames 字段。
 * 对每个 workspace 相对路径查找文件并下载计算内容指纹，优先复用本人已有且可用的资产；未命中时上传文件、
 * 创建个人资产并将 URI 改写为第三方可识别的 asset:// 标识。
 *
 * 同一请求内按原始 URI 缓存解析结果，避免重复下载、计算指纹、查重和上传。已有 asset:// URI、无法解析的路径，
 * 以及处理过程中发生异常的单条素材均保留原值，不影响其他素材和整个视频生成请求继续执行。
 */
final class DesignVideoReferenceAssetResolver
{
    /**
     * 需要转换为个人资产的引用字段；单独的 mask 字段不在本次处理范围内。
     */
    private const array MATERIALIZED_KEYS = [
        'reference_images',
        'reference_videos',
        'reference_audios',
        'frames',
    ];

    private readonly SafeRemoteFileDownloader $remoteFileDownloader;

    /**
     * 初始化任务文件、文件存储和资产服务，并配置安全的远程文件下载器。
     * 下载器允许测试注入替身实现，以避免单元测试访问真实网络资源。
     */
    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly AssetAppService $assetAppService,
        private readonly AssetDomainService $assetDomainService,
        ?SafeRemoteFileDownloader $remoteFileDownloader = null,
    ) {
        // 下载器默认走显式安全配置；测试可注入 mock 以跳过真实网络下载。
        $this->remoteFileDownloader = $remoteFileDownloader ?? new SafeRemoteFileDownloader(new RemoteDownloadSecurityConfig(
            enabled: true,
            level: RemoteDownloadSecurityConfig::LEVEL_STANDARD,
            maxDownloadSize: 100 * 1024 * 1024,
            maxRedirects: 3,
        ));
    }

    /**
     * 解析生成任务中的引用素材，并将可识别的 workspace 路径改写为 asset URI。
     * 单条素材处理失败时保留原始 URI，确保其他输入仍可继续参与视频生成。
     */
    public function resolve(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $resolvedCache = [];

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();
        $projectId = $entity->getProjectId();

        $inputs = $entity->getInputPayload();
        $requestInputs = $entity->getRequestPayload()['inputs'] ?? [];

        foreach (self::MATERIALIZED_KEYS as $key) {
            if (array_key_exists($key, $inputs)) {
                $inputs[$key] = $this->materializeList($dataIsolation, $projectId, $organizationCode, $userId, $inputs[$key], $resolvedCache);
            }
            if (array_key_exists($key, $requestInputs)) {
                $requestInputs[$key] = $this->materializeList($dataIsolation, $projectId, $organizationCode, $userId, $requestInputs[$key], $resolvedCache);
            }
        }

        $entity->setInputPayload($inputs);
        $entity->setRequestPayload(array_merge($entity->getRequestPayload(), ['inputs' => $requestInputs]));
    }

    /**
     * 遍历一个引用素材列表，并只替换每项中的 uri 字段。
     * 非数组项保持原样；方法返回与输入结构一致的列表，供任务实体重新写回。
     *
     * @param array<int, array<string, mixed>> $items 待解析的引用素材列表
     * @return array<int, array<string, mixed>> 处理后的引用素材列表
     */
    private function materializeList(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $organizationCode,
        string $userId,
        array $items,
        array &$resolvedCache,
    ): array {
        foreach ($items as &$item) {
            if (! is_array($item)) {
                continue;
            }
            $item['uri'] = $this->resolveUri(
                $dataIsolation,
                $projectId,
                $organizationCode,
                $userId,
                (string) ($item['uri'] ?? ''),
                $resolvedCache,
            );
        }
        unset($item);
        return $items;
    }

    /**
     * 解析单个引用 URI，并优先从本次请求缓存中返回已处理结果。
     * 缓存命中时不会再次下载文件或访问资产服务，避免重复执行相同的转换流程。
     */
    private function resolveUri(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $organizationCode,
        string $userId,
        string $uri,
        array &$resolvedCache,
    ): string {
        if (isset($resolvedCache[$uri])) {
            return $resolvedCache[$uri];
        }
        $resolved = $this->doResolveUri($dataIsolation, $projectId, $organizationCode, $userId, $uri);
        $resolvedCache[$uri] = $resolved;
        return $resolved;
    }

    /**
     * 执行单个 URI 的实际材质化流程，包括路径查找、下载、去重、上传和资产登记。
     * 对于无效路径、已有 asset URI 或任意处理异常，均返回原始 URI 以保证请求可用。
     */
    private function doResolveUri(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $organizationCode,
        string $userId,
        string $uri,
    ): string {
        if ($uri === '') {
            return $uri;
        }

        if (ProviderAssetUri::isLocalAsset($uri)) {
            $localAssetId = ProviderAssetUri::getLocalAssetId($uri);
            if ($localAssetId === null) {
                return $uri;
            }
            try {
                $asset = $this->assetAppService->prepareAssetForProviderSync($dataIsolation, $localAssetId);
                if ($asset === null) {
                    return $uri;
                }
                $providerAssetId = $this->assetDomainService->ensureProviderAssetId(
                    AssetDataIsolation::createByBaseDataIsolation($dataIsolation),
                    $asset,
                );
                return $providerAssetId === null || $providerAssetId === ''
                    ? $uri
                    : 'asset://' . $providerAssetId;
            } catch (Throwable $throwable) {
                di(LoggerInterface::class)->error(__METHOD__ . ':' . $throwable->getMessage(), [
                    'asset_id' => $localAssetId,
                ]);
                return $uri;
            }
        }

        // asset://asset-... 已经是火山方舟素材引用，直接透传。
        if (ProviderAssetUri::isValid($uri)) {
            return $uri;
        }

        $fileEntity = $this->taskFileDomainService->findEntityByRelativePath($projectId, $uri);
        if (! $fileEntity instanceof TaskFileEntity) {
            return $uri;
        }

        $url = $this->fileDomainService
            ->getLink($organizationCode, $fileEntity->getFileKey(), StorageBucketType::SandBox)
            ?->getUrl();
        if ($url === null || $url === '') {
            return $uri;
        }

        try {
            $downloaded = $this->remoteFileDownloader->download($url);
            $hash = hash_file('sha256', $downloaded->getRealPath());
        } catch (Throwable) {
            return $uri;
        }
        try {
            // 组织与用户都不收敛：第三方审核结果属于公共资源，同一份内容命中谁已 PASS 的凭证都可用。
            $providerAssetEntity = $this->assetDomainService->findPassedProviderAssetByContentHash($hash);
            if ($providerAssetEntity && $providerAssetEntity->getProviderStatus()->isPassed()) {
                return $providerAssetEntity->getProviderAssetId() ? 'asset://' . $providerAssetEntity->getProviderAssetId() : $uri;
            }

            // 必须带上带扩展名的文件名：临时文件路径无后缀，会让私有桶 key 丢后缀，
            $uploadFile = new UploadFile(
                $downloaded->getRealPath(),
                FileUploadBusinessCode::ASSET->getDir(),
                $downloaded->getName(),
            );
            $this->fileDomainService->uploadByCredential($organizationCode, $uploadFile);

            // 视频生成链路必须立即拿到 provider_asset_id，因此这里使用同步创建；普通素材创建接口仍保持异步。
            $asset = $this->assetAppService->createPersonalAsset(
                $dataIsolation,
                $this->buildCreateDto($uploadFile->getKey(), $fileEntity->getFileName()),
                true,
            );
            if (! $asset->getId()) {
                return $uri;
            }
            // 新建素材同步完成后才能拿到第三方素材 ID；取不到则退回原始 uri，保障本次请求可用。
            $providerAssetEntity = $this->assetDomainService->findProviderAsset(
                AssetDataIsolation::createByBaseDataIsolation($dataIsolation),
                $asset->getId(),
            );
            if ($providerAssetEntity && $providerAssetEntity->getProviderStatus()->isPassed()) {
                return $providerAssetEntity->getProviderAssetId() ? 'asset://' . $providerAssetEntity->getProviderAssetId() : $uri;
            }
            return $uri;
        } catch (Throwable $throwable) {
            di(LoggerInterface::class)->error(__METHOD__ . ':' . $throwable->getMessage());
            // 任何登记失败（如未签素材协议、上传异常）都退回原始 uri，不影响本次生成请求。
            return $uri;
        } finally {
            @unlink($downloaded->getRealPath());
        }
    }

    /**
     * 根据已上传文件的存储键和原始文件名构造个人资产创建请求。
     * DTO 会明确设置素材类型、业务类型、展示名称和文件键，供资产服务完成登记。
     */
    private function buildCreateDto(string $fileKey, string $name): CreateAssetRequestDTO
    {
        $dto = new CreateAssetRequestDTO();
        $dto->setAssetKind('ASSET');
        $dto->setAssetBusinessType('GENERAL');
        $dto->setName($name);
        $dto->setFileKey($fileKey);
        return $dto;
    }
}
