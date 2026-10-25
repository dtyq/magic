<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetVisibility;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Utils\RemoteDownloadSecurityConfig;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

abstract class AbstractAssetAppService extends AbstractKernelAppService
{
    public function __construct(
        protected readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
    ) {
    }

    /**
     * 登记资产可见性。
     *
     * 可见性表是**叠加**的授权通道：资产列表/详情仍按 organization_code + user_id 判定，
     * 这里只负责登记授权凭据，供权限台读取。
     */
    protected function grantAssetVisibility(
        AssetDataIsolation $dataIsolation,
        null|AssetEntity|int|string $asset,
        AssetVisibility $visibility,
    ): void {
        $assetCode = $this->assetResourceCode($asset);
        $principals = $visibility->principals($dataIsolation->getCurrentUserId());
        if ($assetCode === '' || $principals === []) {
            return;
        }
        $permissionDataIsolation = $this->permissionDataIsolation($dataIsolation);
        foreach ($principals as $principalType => $principalIds) {
            $this->resourceVisibilityDomainService->addResourceVisibilityByPrincipalsIfMissing(
                $permissionDataIsolation,
                ResourceType::ASSET,
                $assetCode,
                PrincipalType::from($principalType),
                $principalIds,
            );
        }
    }

    /**
     * 清理资产的全部可见性记录（资产删除时调用）。
     *
     * 删除是资源行的终点，此时不能按主体撤销：团队分享给其他用户或部门的记录不归当前用户所有，
     * 按当前用户/官方组织撤销会漏掉它们，在 magic_resource_visibility 里留下指向已删除资产的悬空授权。
     * 所以这里按资源一次性清空，主体类型和主体 ID 都不参与条件。
     */
    protected function clearAssetVisibility(AssetDataIsolation $dataIsolation, null|AssetEntity|int|string $asset): void
    {
        $assetCode = $this->assetResourceCode($asset);
        if ($assetCode === '') {
            return;
        }
        $this->resourceVisibilityDomainService->deleteResourceVisibility(
            $this->permissionDataIsolation($dataIsolation),
            ResourceType::ASSET,
            $assetCode,
        );
    }

    /**
     * 撤销资产可见性（官方公开资产下架时调用），写入目标与授权时一一对应。
     */
    protected function revokeAssetVisibility(
        AssetDataIsolation $dataIsolation,
        null|AssetEntity|int|string $asset,
        AssetVisibility $visibility,
    ): void {
        $assetCode = $this->assetResourceCode($asset);
        $principals = $visibility->principals($dataIsolation->getCurrentUserId());
        if ($assetCode === '' || $principals === []) {
            return;
        }
        $permissionDataIsolation = $this->permissionDataIsolation($dataIsolation);
        foreach ($principals as $principalType => $principalIds) {
            $this->resourceVisibilityDomainService->deleteResourceVisibilityByPrincipals(
                $permissionDataIsolation,
                ResourceType::ASSET,
                $assetCode,
                PrincipalType::from($principalType),
                $principalIds,
            );
        }
    }

    /**
     * 官方公开资产的可见性主体是官方组织码，配置缺失时退回当前组织码（管理端已校验两者一致）。
     */
    protected function officialOrganizationCode(AssetDataIsolation $dataIsolation): string
    {
        return $dataIsolation->getOfficialOrganizationCode() ?: $dataIsolation->getCurrentOrganizationCode();
    }

    /**
     * 解析「团队分享」范围：当前用户（本人 / 所属部门 / 本组织）在 magic_resource_visibility 里命中的资产主键。
     *
     * 仓储只负责做 IN 过滤，不跨领域读权限表，所以这里由应用层解析后塞进查询条件。
     *
     * @param null|array<string> $assetIds 只判定这些资产是否被授权（详情场景按需精确查询）；null 表示取全部
     * @return array<string>
     */
    protected function sharedAssetIds(AssetDataIsolation $dataIsolation, ?array $assetIds = null): array
    {
        return $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->permissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId(),
            ResourceType::ASSET,
            $assetIds,
        );
    }

    protected function permissionDataIsolation(AssetDataIsolation $dataIsolation): PermissionDataIsolation
    {
        return PermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
    }

    protected function createAssetEntity(
        CreateAssetRequestDTO $requestDTO,
        bool $allowProviderAsset = false,
        ?string $organizationCode = null,
    ): AssetEntity {
        if (! $allowProviderAsset && $requestDTO->getAssetKind() === 'ASSET' && trim((string) $requestDTO->getFileKey()) === '') {
            ExceptionBuilder::throw(AssetErrorCode::FILE_REQUIRED);
        }

        $fileKey = $requestDTO->getFileKey();
        $nameI18n = $requestDTO->getNameI18n();
        if ($nameI18n === [] && $fileKey !== null && $fileKey !== '') {
            $nameI18n = ['default' => basename($fileKey)];
        }

        return new AssetEntity(array_filter([
            'organization_code' => $organizationCode,
            'asset_kind' => $requestDTO->getAssetKind(),
            'asset_business_type' => $requestDTO->getAssetBusinessType(),
            'parent_id' => $requestDTO->getParentId(),
            'name_i18n' => $nameI18n,
            'description_i18n' => $requestDTO->getDescriptionI18n(),
            'file_key' => $fileKey,
            'asset_media_type' => $this->resolveMediaType($fileKey),
        ], static fn (mixed $value): bool => $value !== null));
    }

    protected function applyUpdateAssetDTO(AssetEntity $asset, UpdateAssetRequestDTO $requestDTO): void
    {
        if ($requestDTO->getNameI18n() !== null) {
            $asset->setNameI18n($requestDTO->getNameI18n());
        }
        if ($requestDTO->getDescriptionI18n() !== null) {
            $asset->setDescriptionI18n($requestDTO->getDescriptionI18n());
        }
        if ($requestDTO->getParentId() !== null) {
            $asset->setParentId($requestDTO->getParentId());
        }
        if ($requestDTO->getStatus() !== null) {
            $asset->setStatus($requestDTO->getStatus());
        }
    }

    /**
     * 按 file_key 批量解析素材链接（素材只落在私有桶），返回 组织码 => [file_key => FileLink]。
     * 不要求实体已有 id，因此创建前也能用来给第三方准备 file_url。
     *
     * @param AssetEntity[] $assets
     * @return array<string, array<string, FileLink>>
     */
    protected function resolveFileLinks(array $assets): array
    {
        $pathsByOrganization = [];
        foreach ($assets as $asset) {
            $fileKey = $asset->getFileKey();
            if ($fileKey === null || $fileKey === '') {
                continue;
            }
            $pathsByOrganization[$asset->getOrganizationCode()][] = $fileKey;
        }

        $linksByOrganization = [];
        foreach ($pathsByOrganization as $organizationCode => $paths) {
            // 素材统一存放在私有桶，按组织批量解析文件链接。
            $linksByOrganization[$organizationCode] = $this->getPrivateFileLinks(
                (string) $organizationCode,
                array_values(array_unique($paths)),
            );
        }
        return $linksByOrganization;
    }

    /**
     * 把 file_key 解析出的链接写回实体。解析不到时置空，由第三方适配器按 file_required 返回，
     * 列表/详情场景不允许因为单个文件失效而整体失败。
     *
     * @param AssetEntity[] $assets
     */
    protected function resolveAssetFileUrls(array $assets): void
    {
        $linksByOrganization = $this->resolveFileLinks($assets);
        foreach ($assets as $asset) {
            $fileKey = $asset->getFileKey();
            $link = $fileKey === null || $fileKey === ''
                ? null
                : ($linksByOrganization[$asset->getOrganizationCode()][$fileKey] ?? null);
            $asset->setFileUrl($link instanceof FileLink ? $link->getUrl() : null);
        }
    }

    /**
     * 计算文件内容指纹，用于复用已同步的第三方素材；下载或校验失败时跳过复用。
     */
    protected function resolveContentHash(AssetEntity $asset): ?string
    {
        if ($asset->getAssetKind()->isGroup()) {
            return null;
        }
        $fileUrl = $asset->getFileUrl();
        if ($fileUrl === null || $fileUrl === '') {
            return null;
        }
        $downloader = new SafeRemoteFileDownloader(
            new RemoteDownloadSecurityConfig(
                enabled: true,
                level: RemoteDownloadSecurityConfig::LEVEL_STANDARD,
                maxDownloadSize: 100 * 1024 * 1024,
                maxRedirects: 3,
            )
        );
        try {
            $downloadedFile = $downloader->download($fileUrl);
        } catch (Throwable) {
            return null;
        }
        try {
            $hash = hash_file('sha256', $downloadedFile->getRealPath());
        } finally {
            @unlink($downloadedFile->getRealPath());
        }
        return is_string($hash) ? $hash : null;
    }

    protected function createAssetDataIsolation(Authenticatable|BaseDataIsolation $authorization): AssetDataIsolation
    {
        if ($authorization instanceof AssetDataIsolation) {
            return $authorization;
        }
        $dataIsolation = new AssetDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            $dataIsolation->setOfficialOrganizationCodes($authorization->getOfficialOrganizationCodes());
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    private function resolveMediaType(?string $fileKey): ?string
    {
        $extension = strtolower(pathinfo((string) $fileKey, PATHINFO_EXTENSION));
        return match (true) {
            in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'], true) => 'IMAGE',
            in_array($extension, ['mp4', 'mov', 'avi', 'webm', 'mkv'], true) => 'VIDEO',
            in_array($extension, ['mp3', 'wav', 'm4a', 'aac', 'flac'], true) => 'AUDIO',
            default => null,
        };
    }

    /**
     * 资产可见性记录（magic_resource_visibility）里，资产用主键作为资源编码。
     */
    private function assetResourceCode(null|AssetEntity|int|string $asset): string
    {
        return (string) ($asset instanceof AssetEntity ? $asset->getId() : $asset);
    }
}
