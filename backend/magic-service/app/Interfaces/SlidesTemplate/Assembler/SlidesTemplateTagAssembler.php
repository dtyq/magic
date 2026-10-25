<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Assembler;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateTagItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\I18nTextDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateSimpleTagItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateTagGroupItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateTagItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateTagPageDTO;

class SlidesTemplateTagAssembler
{
    /**
     * @param SlidesTemplateTagEntity[] $tags
     */
    public static function createPageDTO(array $tags, Page $page, int $total, bool $admin): SlidesTemplateTagPageDTO
    {
        $list = array_map(
            static fn (SlidesTemplateTagEntity $tag): AdminSlidesTemplateTagItemDTO|SlidesTemplateTagItemDTO => $admin
                ? self::createAdminItemDTO($tag)
                : self::createPublicItemDTO($tag),
            $tags
        );

        return new SlidesTemplateTagPageDTO($page->getPage(), $page->getPageNum(), $total, $list);
    }

    public static function createPublicItemDTO(SlidesTemplateTagEntity $tag): SlidesTemplateTagItemDTO
    {
        $dto = new SlidesTemplateTagItemDTO();
        self::fillBase($dto, $tag);
        return $dto;
    }

    public static function createSimplePublicItemDTO(SlidesTemplateTagEntity $tag): SlidesTemplateSimpleTagItemDTO
    {
        $dto = new SlidesTemplateSimpleTagItemDTO();
        $dto->setId($tag->getId());
        $dto->setCode($tag->getCode());
        $dto->setName($tag->getI18nName(CoContext::getLanguage()));
        $dto->setNameI18n(I18nTextDTO::fromArray($tag->getNameI18n()));
        $dto->setSort($tag->getSort());
        return $dto;
    }

    /**
     * @param SlidesTemplateTagEntity[] $groups
     */
    public static function createGroupListDTO(array $groups): array
    {
        return array_map(static function (SlidesTemplateTagEntity $group): array {
            $dto = new SlidesTemplateTagGroupItemDTO();
            $dto->setId($group->getId());
            $dto->setCode($group->getCode());
            $dto->setName($group->getI18nName(CoContext::getLanguage()));
            $dto->setNameI18n(I18nTextDTO::fromArray($group->getNameI18n()));
            $dto->setSort($group->getSort());
            $dto->setTags(array_map(
                static fn (SlidesTemplateTagEntity $tag): SlidesTemplateSimpleTagItemDTO => self::createSimplePublicItemDTO($tag),
                $group->getChildren()
            ));

            $item = $dto->toArray();
            unset($item['name_i18n']);
            foreach ($item['tags'] as &$tag) {
                unset($tag['name_i18n']);
            }
            unset($tag);

            return $item;
        }, $groups);
    }

    /**
     * @param SlidesTemplateTagEntity[] $groups
     */
    public static function createAdminTreeDTO(array $groups): array
    {
        return array_map(static function (SlidesTemplateTagEntity $group): array {
            $item = self::createAdminItemDTO($group)->toArray();
            unset($item['template_count']);
            $item['children'] = array_map(
                static function (SlidesTemplateTagEntity $tag): array {
                    $child = self::createAdminItemDTO($tag)->toArray();
                    unset($child['template_count']);
                    return $child;
                },
                $group->getChildren()
            );

            return $item;
        }, $groups);
    }

    public static function createAdminItemDTO(SlidesTemplateTagEntity $tag): AdminSlidesTemplateTagItemDTO
    {
        $dto = new AdminSlidesTemplateTagItemDTO();
        self::fillBase($dto, $tag);
        $dto->setOrganizationCode($tag->getOrganizationCode());
        $dto->setStatus($tag->getStatus()->value);
        $dto->setCreatedUid($tag->getCreatedUid());
        $dto->setUpdatedUid($tag->getUpdatedUid());
        $dto->setCreatedAt($tag->getCreatedAt());
        $dto->setUpdatedAt($tag->getUpdatedAt());
        return $dto;
    }

    private static function fillBase(SlidesTemplateTagItemDTO $dto, SlidesTemplateTagEntity $tag): void
    {
        $dto->setId($tag->getId());
        $dto->setCode($tag->getCode());
        $dto->setName($tag->getI18nName(CoContext::getLanguage()));
        $dto->setNameI18n(I18nTextDTO::fromArray($tag->getNameI18n()));
        $dto->setParentId($tag->getParentId());
        $dto->setNodeType($tag->getNodeType()->value);
        $dto->setDescriptionI18n(I18nTextDTO::fromArray($tag->getDescriptionI18n()));
        $dto->setSort($tag->getSort());
        $dto->setTemplateCount($tag->getTemplateCount());
        $dto->setIsOfficial(OfficialOrganizationUtil::isOfficialOrganization($tag->getOrganizationCode()));
    }
}
