<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\Assembler;

use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Domain\Asset\Repository\Persistence\Model\AssetModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Asset\DTO\Response\AdminAssetDTO;
use App\Interfaces\Asset\DTO\Response\AdminDeleteAssetDTO;
use App\Interfaces\Asset\DTO\Response\AssetDTO;
use App\Interfaces\Asset\DTO\Response\AssetListDTO;
use App\Interfaces\Asset\DTO\Response\DeleteAssetDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class AssetAssembler
{
    public static function createTagList(array $tags): array
    {
        return array_map(static function (AssetTagEntity $group): array {
            $item = self::createTagItem($group);
            $item['tags'] = array_map(static fn (AssetTagEntity $tag): array => self::createTagItem($tag), $group->getChildren());
            return $item;
        }, $tags);
    }

    public static function createTagItem(AssetTagEntity $tag): array
    {
        return [
            'id' => (string) $tag->getId(),
            'parentId' => (string) $tag->getParentId(),
            'businessType' => $tag->getBusinessType(),
            'nodeType' => $tag->getNodeType()->value,
            'name' => $tag->getI18nName(self::language()),
            'ownerUid' => $tag->getOwnerUid(),
            'isOfficial' => $tag->getOwnerUid() === null,
        ];
    }

    public static function createOwnerList(array $owners): array
    {
        return array_map(static fn (array $owner): array => [
            'id' => (string) ($owner['id'] ?? ''),
            'name' => (string) ($owner['name'] ?? ''),
        ], $owners);
    }

    public static function createItem(
        AssetEntity|AssetModel $asset,
        ?FileLink $fileLink = null,
        bool $admin = false,
        ?ProviderAssetEntity $providerAsset = null,
    ): AdminAssetDTO|AssetDTO {
        $entity = $asset instanceof AssetEntity ? $asset : new AssetEntity($asset->toArray());
        $dto = $admin ? new AdminAssetDTO() : new AssetDTO();
        $dto->setAssetId($entity->getId());
        $dto->setAssetKind($entity->getAssetKind()->value);
        $dto->setAssetBusinessType($entity->getAssetBusinessType());
        $dto->setAssetMediaType($entity->getAssetMediaType()?->value);
        $dto->setParentId($entity->getParentId());
        $dto->setName($entity->getI18nName(self::language()));
        $dto->setDescription($entity->getI18nDescription(self::language()));
        $dto->setFileUrl($fileLink?->getUrl() ?? $entity->getFileUrl());
        $dto->setFileKey($entity->getFileKey());
        $complianceStatus = $providerAsset?->getProviderStatus() ?? ProviderAssetStatus::UNVERIFIED;
        $dto->setComplianceStatus($complianceStatus->value);
        // 只有 FAILED 才带原因：状态被重新写成通过或审核中之后，上一轮的失败原因不能再透给前端。
        $dto->setComplianceFailedReason(
            $complianceStatus === ProviderAssetStatus::FAILED ? $providerAsset?->getProviderFailedReason() : null,
        );
        $dto->setComplianceReviewMode(
            ($providerAsset?->getProviderReviewMode() ?? ProviderReviewMode::VOLCENGINE)->value,
        );
        $ownerUid = $entity->getOwnerUid() ?: $entity->getUserId();
        $dto->setOwner($ownerUid, $entity->getOwnerName());
        $dto->setOwnerUid($ownerUid);
        $dto->setSource($entity->getSource());
        $dto->setVisibilityType($entity->getVisibilityType()->value);
        $dto->setTags($entity->getTags());
        if ($admin) {
            $dto->setStatus($entity->getStatus()->value);
        }
        return $dto;
    }

    public static function createList(
        array $assets,
        Page $page,
        int $total,
        array $fileLinks = [],
        bool $admin = false,
        array $providerAssets = [],
    ): AssetListDTO {
        $items = [];
        foreach ($assets as $asset) {
            if (! $asset instanceof AssetModel && ! $asset instanceof AssetEntity) {
                continue;
            }
            $assetId = $asset instanceof AssetEntity ? $asset->getId() : $asset->getKey();
            $items[] = self::createItem(
                $asset,
                $fileLinks[(string) $assetId] ?? null,
                $admin,
                $providerAssets[(string) $assetId] ?? null,
            );
        }
        return new AssetListDTO($page->getPage(), $page->getPageNum(), $total, $items);
    }

    public static function createDeleteDTO(int|string $assetId, bool $deleted, bool $admin = false): AdminDeleteAssetDTO|DeleteAssetDTO
    {
        return $admin
            ? new AdminDeleteAssetDTO($assetId, $deleted)
            : new DeleteAssetDTO($assetId, $deleted);
    }

    private static function language(): string
    {
        return CoContext::getLanguage();
    }
}
