<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Assembler;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateCategoryItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateCategorySummaryDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\I18nTextDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateCategoryItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateCategoryPageDTO;

class SlidesTemplateCategoryAssembler
{
    /**
     * @param SlidesTemplateCategoryEntity[] $categories
     */
    public static function createPageDTO(array $categories, Page $page, int $total, bool $admin): SlidesTemplateCategoryPageDTO
    {
        $list = array_map(
            static fn (SlidesTemplateCategoryEntity $category): AdminSlidesTemplateCategoryItemDTO|SlidesTemplateCategoryItemDTO => $admin
                ? self::createAdminItemDTO($category)
                : self::createPublicItemDTO($category),
            $categories
        );

        return new SlidesTemplateCategoryPageDTO($page->getPage(), $page->getPageNum(), $total, $list);
    }

    public static function createAdminItemDTO(SlidesTemplateCategoryEntity $category): AdminSlidesTemplateCategoryItemDTO
    {
        $dto = new AdminSlidesTemplateCategoryItemDTO();
        self::fillBase($dto, $category);
        $dto->setNameI18n(I18nTextDTO::fromArray($category->getNameI18n()));
        $dto->setTemplateCount($category->getTemplateCount());
        $dto->setOrganizationCode($category->getOrganizationCode());
        $dto->setStatus($category->getStatus()->value);
        $dto->setCreatedUid($category->getCreatedUid());
        $dto->setUpdatedUid($category->getUpdatedUid());
        $dto->setCreatedAt($category->getCreatedAt());
        $dto->setUpdatedAt($category->getUpdatedAt());
        return $dto;
    }

    public static function createPublicItemDTO(SlidesTemplateCategoryEntity $category): SlidesTemplateCategoryItemDTO
    {
        $dto = new SlidesTemplateCategoryItemDTO();
        self::fillBase($dto, $category);
        return $dto;
    }

    public static function createAdminSummaryDTO(SlidesTemplateCategoryEntity $category): AdminSlidesTemplateCategorySummaryDTO
    {
        $dto = new AdminSlidesTemplateCategorySummaryDTO();
        $dto->setId($category->getId());
        $dto->setCode($category->getCode());
        $dto->setNameI18n(I18nTextDTO::fromArray($category->getNameI18n()));
        $dto->setStatus($category->getStatus()->value);
        $dto->setSort($category->getSort());
        $dto->setIsOfficial(OfficialOrganizationUtil::isOfficialOrganization($category->getOrganizationCode()));
        return $dto;
    }

    private static function fillBase(SlidesTemplateCategoryItemDTO $dto, SlidesTemplateCategoryEntity $category): void
    {
        $dto->setId($category->getId());
        $dto->setCode($category->getCode());
        $dto->setName($category->getI18nName(CoContext::getLanguage()));
        $dto->setSort($category->getSort());
        $dto->setIsOfficial(OfficialOrganizationUtil::isOfficialOrganization($category->getOrganizationCode()));
    }
}
