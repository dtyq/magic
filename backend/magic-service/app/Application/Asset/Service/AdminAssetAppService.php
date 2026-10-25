<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Service;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\AssetTagNodeType;
use App\Domain\Asset\Entity\ValueObject\AssetVisibility;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Qbhy\HyperfAuth\Authenticatable;

class AdminAssetAppService extends AbstractAssetAppService
{
    public function __construct(
        protected readonly AssetDomainService $assetDomainService,
        ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected readonly AssetTagDomainService $assetTagDomainService,
    ) {
        parent::__construct($resourceVisibilityDomainService);
    }

    /** @param null|string $businessType 只看某个业务类型；null 表示后台查看全部 */
    public function listOfficialTags(Authenticatable|BaseDataIsolation $authorization, ?string $businessType = null): array
    {
        return $this->assetTagDomainService->listVisible($this->officialDataIsolation($authorization), $businessType);
    }

    public function createOfficialTag(
        Authenticatable|BaseDataIsolation $authorization,
        string $name,
        string $nodeType,
        int $parentId,
        string $businessType = AssetTagEntity::DEFAULT_BUSINESS_TYPE,
    ): AssetTagEntity {
        $isolation = $this->officialDataIsolation($authorization);
        return $this->assetTagDomainService->createOfficial($isolation, $name, AssetTagNodeType::from($nodeType), $parentId, $businessType);
    }

    public function updateOfficialTag(Authenticatable|BaseDataIsolation $authorization, int|string $id, string $name, string $nodeType, int $parentId): AssetTagEntity
    {
        $isolation = $this->officialDataIsolation($authorization);
        return $this->assetTagDomainService->updateOfficial($isolation, $id, $name, AssetTagNodeType::from($nodeType), $parentId);
    }

    public function deleteOfficialTag(Authenticatable|BaseDataIsolation $authorization, int|string $id): void
    {
        $this->assetTagDomainService->deleteOfficial($this->officialDataIsolation($authorization), $id);
    }

    /**
     * 第三方素材与素材组的占用数量，用于核对火山方舟侧的配额消耗。
     *
     * @return array{assets: int, groups: int}
     */
    public function providerResourceUsage(): array
    {
        return $this->assetDomainService->countProviderResourceUsage();
    }

    public function createPublicAsset(
        Authenticatable|BaseDataIsolation $authorization,
        CreateAssetRequestDTO $requestDTO,
    ): AssetEntity {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);
        $asset = $this->createAssetEntity($requestDTO, true, $dataIsolation->getCurrentOrganizationCode());
        // 素材只落在私有桶：创建前解析出 file_url 供第三方拉取；落库后的实体不含该字段，回填给响应。
        $this->resolveAssetFileUrls([$asset]);
        // 内容指纹在同一份链接上算：同一张图片此后复用已审核通过的第三方素材，不再重复上传。
        $asset->setContentHash($this->resolveContentHash($asset));
        $fileUrl = $asset->getFileUrl();
        $asset = $this->assetDomainService->createPublic($dataIsolation, $asset);
        // 官方公开资产记 ORGANIZATION→官方组织码：查询判定仍靠官方组织码 + user_id IS NULL。
        $this->grantAssetVisibility($dataIsolation, $asset, $this->publicVisibility($dataIsolation));
        $asset->setFileUrl($fileUrl);
        return $asset;
    }

    public function list(
        Authenticatable|BaseDataIsolation $authorization,
        QueryAssetRequestDTO $requestDTO,
    ): array {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);
        $dataIsolation->setOnlyOfficialOrganization(true);
        $page = new Page(
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
        );
        $result = $this->assetDomainService->queries($dataIsolation, $this->createQuery($requestDTO), $page);
        $this->resolveAssetFileUrls($result['list']);
        $result['provider_assets'] = $this->assetDomainService->findProviderAssets(
            $dataIsolation,
            array_values(array_filter(array_map(
                static fn (AssetEntity $asset): ?int => $asset->getId(),
                $result['list'],
            ))),
        );
        return $result;
    }

    public function providerAsset(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): ?ProviderAssetEntity
    {
        $dataIsolation = $this->officialDataIsolation($authorization);
        return $this->assetDomainService->findProviderAssets($dataIsolation, [$assetId])[(string) $assetId] ?? null;
    }

    public function updatePublicAsset(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
        UpdateAssetRequestDTO $requestDTO,
    ): ?AssetEntity {
        $dataIsolation = $this->officialDataIsolation($authorization);
        $existing = $this->assetDomainService->findPublic($dataIsolation, $assetId);
        if ($existing === null) {
            return null;
        }
        $this->applyUpdateAssetDTO($existing, $requestDTO);
        $updated = $this->assetDomainService->updatePublic(
            $dataIsolation,
            $existing,
        );
        if ($updated !== null) {
            $this->syncPublicVisibility($dataIsolation, $updated);
            // 更新响应需要返回最新的私有文件链接。
            $this->resolveAssetFileUrls([$updated]);
        }
        return $updated;
    }

    public function deletePublicAsset(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
    ): bool {
        $dataIsolation = $this->officialDataIsolation($authorization);
        $deleted = $this->assetDomainService->deletePublic($dataIsolation, $assetId);
        if ($deleted) {
            // 资产行已删除，授权记录不能悬空，否则权限台会显示一条指向不存在资产的授权。
            // 按资源整体清理，避免公开素材曾追加的其他主体记录残留。
            $this->clearAssetVisibility($dataIsolation, $assetId);
        }
        return $deleted;
    }

    /**
     * 公开资产的可见性跟着启用状态走：下架即撤销，重新上架再补回。
     */
    protected function syncPublicVisibility(AssetDataIsolation $dataIsolation, AssetEntity $asset): void
    {
        $visibility = $this->publicVisibility($dataIsolation);
        if ($asset->getStatus()->isEnabled()) {
            $this->grantAssetVisibility($dataIsolation, $asset, $visibility);
            return;
        }
        $this->revokeAssetVisibility($dataIsolation, $asset, $visibility);
    }

    protected function publicVisibility(AssetDataIsolation $dataIsolation): AssetVisibility
    {
        return AssetVisibility::organization($this->officialOrganizationCode($dataIsolation));
    }

    protected function officialDataIsolation(Authenticatable|BaseDataIsolation $authorization): AssetDataIsolation
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);
        return $dataIsolation;
    }

    protected function assertOfficialOrganization(AssetDataIsolation $dataIsolation): void
    {
        if (! $dataIsolation->isOfficialOrganization()) {
            ExceptionBuilder::throw(AssetErrorCode::ADMIN_DENIED);
        }
    }

    private function createQuery(QueryAssetRequestDTO $requestDTO): AssetQuery
    {
        $query = new AssetQuery();
        $query->setScope(AssetScope::PUBLIC);
        $query->setAssetKind($requestDTO->getAssetKind());
        $query->setParentId($requestDTO->getParentId());
        $query->setAssetBusinessType($requestDTO->getAssetBusinessType());
        $query->setAssetMediaType($requestDTO->getAssetMediaType());
        $query->setKeyword($requestDTO->getKeyword());
        $query->setStatus($requestDTO->getStatus());
        return $query;
    }
}
