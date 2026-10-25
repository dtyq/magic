<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Service;

use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ValueObject\AssetBusinessType;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 人设头像库的后台管理：只管理业务类型为 PERSONA_AVATAR 的官方素材。
 *
 * 与通用的官方素材管理（AdminAssetAppService）相比：
 * - 素材只落本地，不向第三方注册、不做合规审核（头像是平台自己生成的虚构人物）；
 * - 创建和更新时同步标签，标签必须同属 PERSONA_AVATAR 业务类型；
 * - 查询和删除都限定在该业务类型内，不会误碰通用素材。
 *
 * 文件需要先上传到对象存储，这里只接收 file_key。
 */
class AdminPersonaAvatarAppService extends AdminAssetAppService
{
    public function createAvatar(Authenticatable|BaseDataIsolation $authorization, CreateAssetRequestDTO $requestDTO): AssetEntity
    {
        $dataIsolation = $this->officialDataIsolation($authorization);
        // 类型和素材种类由本接口决定，不接受调用方指定。
        $requestDTO->setAssetKind('ASSET');
        $requestDTO->setAssetBusinessType(AssetBusinessType::PERSONA_AVATAR);
        $requestDTO->parentId = null;

        $asset = $this->createAssetEntity($requestDTO, false, $dataIsolation->getCurrentOrganizationCode());
        if ($requestDTO->status !== null) {
            $asset->setStatus($requestDTO->status);
        }
        $this->resolveAssetFileUrls([$asset]);
        $fileUrl = $asset->getFileUrl();

        $saved = $this->assetDomainService->createPublicLocalOnly($dataIsolation, $asset);
        $this->syncPublicVisibility($dataIsolation, $saved);
        $this->assetTagDomainService->syncAssetTags($dataIsolation, $saved, $requestDTO->getTagIds());
        $saved->setFileUrl($fileUrl);
        return $saved;
    }

    /**
     * @return array{total: int, list: AssetEntity[]}
     */
    public function listAvatars(Authenticatable|BaseDataIsolation $authorization, QueryAssetRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->officialDataIsolation($authorization);
        $dataIsolation->setOnlyOfficialOrganization(true);

        $query = new AssetQuery();
        $query->setScope(AssetScope::PUBLIC);
        $query->setAssetKind('ASSET');
        $query->setAssetBusinessType(AssetBusinessType::PERSONA_AVATAR);
        $query->setKeyword($requestDTO->getKeyword());
        // 后台默认看全部状态，便于发现已下架的头像。
        $query->setStatus($requestDTO->getStatus());
        $query->setTagIds($requestDTO->getTagIds());
        $query->setTagMatch($requestDTO->getTagMatch());
        $result = $this->assetDomainService->queries(
            $dataIsolation,
            $query,
            new Page($requestDTO->getPage(), $requestDTO->getPageSize()),
        );

        $this->resolveAssetFileUrls($result['list']);
        $tagsByAsset = $this->assetTagDomainService->findTagsByAssetIds(
            $dataIsolation,
            array_values(array_filter(array_map(static fn (AssetEntity $asset): ?int => $asset->getId(), $result['list']))),
        );
        foreach ($result['list'] as $asset) {
            $asset->setTags(array_map(static fn (AssetTagEntity $tag): array => [
                'id' => (string) $tag->getId(),
                'name' => $tag->getI18nName($dataIsolation->getLanguage()),
            ], $tagsByAsset[(string) $asset->getId()] ?? []));
        }
        return $result;
    }

    /**
     * @param null|array<int, int|string> $tagIds null 表示不改标签；传入数组则整体替换
     */
    public function updateAvatar(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
        UpdateAssetRequestDTO $requestDTO,
        ?array $tagIds,
    ): ?AssetEntity {
        $dataIsolation = $this->officialDataIsolation($authorization);
        $existing = $this->findAvatar($authorization, $assetId);
        if ($existing === null) {
            return null;
        }
        $this->applyUpdateAssetDTO($existing, $requestDTO);
        $updated = $this->assetDomainService->updatePublic($dataIsolation, $existing);
        if ($updated === null) {
            return null;
        }
        $this->syncPublicVisibility($dataIsolation, $updated);
        if ($tagIds !== null) {
            $this->assetTagDomainService->syncAssetTags($dataIsolation, $updated, $tagIds);
        }
        $this->resolveAssetFileUrls([$updated]);
        return $updated;
    }

    public function deleteAvatar(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): bool
    {
        if ($this->findAvatar($authorization, $assetId) === null) {
            return false;
        }
        return $this->deletePublicAsset($authorization, $assetId);
    }

    /** 只在头像库范围内查找，别的业务类型的官方素材一律按不存在处理。 */
    private function findAvatar(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): ?AssetEntity
    {
        $asset = $this->assetDomainService->findPublic($this->officialDataIsolation($authorization), $assetId);
        if ($asset === null || $asset->getAssetBusinessType() !== AssetBusinessType::PERSONA_AVATAR) {
            return null;
        }
        return $asset;
    }
}
