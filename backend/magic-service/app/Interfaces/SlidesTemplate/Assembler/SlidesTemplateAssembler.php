<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Assembler;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateDetailDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateListItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\I18nTextDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SaveUserSlidesTemplateDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateCodeAvailabilityDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateCountDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateFileUrlDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateListPageDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePageDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePublicDetailDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePublicItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePublicListItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\UsedSlidesTemplatePublicListItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\UserSlidesTemplatePublicDetailDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\UserSlidesTemplatePublicListItemDTO;

class SlidesTemplateAssembler
{
    /**
     * @param SlidesTemplateEntity[] $templates
     * @param array<string, SlidesTemplateCategoryEntity> $categoryMap
     */
    public static function createPageDTO(
        array $templates,
        Page $page,
        int $total,
        bool $admin,
        array $categoryMap = []
    ): SlidesTemplatePageDTO {
        $list = array_map(
            static function (SlidesTemplateEntity $template) use ($admin, $categoryMap): AdminSlidesTemplateItemDTO|SlidesTemplatePublicItemDTO {
                if (! $admin) {
                    return self::createPublicItemDTO($template);
                }

                $categoryCode = $template->getCategoryCode();
                $category = $categoryCode === null ? null : ($categoryMap[$categoryCode] ?? null);
                return self::createAdminItemDTO($template, $category);
            },
            $templates
        );

        return new SlidesTemplatePageDTO($page->getPage(), $page->getPageNum(), $total, $list);
    }

    public static function createAdminItemDTO(
        SlidesTemplateEntity $template,
        ?SlidesTemplateCategoryEntity $category = null
    ): AdminSlidesTemplateItemDTO {
        $dto = new AdminSlidesTemplateListItemDTO();
        self::fillAdminItemDTO($dto, $template);
        $dto->setCategory($category === null ? null : SlidesTemplateCategoryAssembler::createAdminSummaryDTO($category));

        return $dto;
    }

    public static function createAdminDetailDTO(SlidesTemplateEntity $template): AdminSlidesTemplateDetailDTO
    {
        $dto = new AdminSlidesTemplateDetailDTO();
        self::fillAdminItemDTO($dto, $template);
        return $dto;
    }

    /**
     * @param SlidesTemplateEntity[] $templates
     */
    public static function createPublicListPageDTO(
        array $templates,
        Page $page,
        array $favoriteCodes = [],
        bool $includeProjectContext = false
    ): SlidesTemplateListPageDTO {
        return new SlidesTemplateListPageDTO(
            $page->getPage(),
            $page->getPageNum(),
            array_map(
                static fn (SlidesTemplateEntity $template): SlidesTemplatePublicListItemDTO => self::createPublicListItemDTO(
                    $template,
                    isset($favoriteCodes[$template->getCode()]),
                    $includeProjectContext
                ),
                $templates
            )
        );
    }

    public static function createPublicListItemDTO(
        SlidesTemplateEntity $template,
        bool $isFavorite = false,
        bool $includeProjectContext = false
    ): SlidesTemplatePublicListItemDTO {
        $dto = $includeProjectContext
            ? new UserSlidesTemplatePublicListItemDTO()
            : new SlidesTemplatePublicListItemDTO();
        self::fillPublicListItemDTO($dto, $template, $isFavorite);
        if ($dto instanceof UserSlidesTemplatePublicListItemDTO) {
            $dto->setProject($template->getProjectId(), $template->getProjectDirectoryId());
        }
        return $dto;
    }

    /**
     * @param array<string, null|string> $latestUsedAtByCode
     */
    public static function createUsedListPageDTO(
        array $templates,
        Page $page,
        array $favoriteCodes = [],
        array $latestUsedAtByCode = []
    ): SlidesTemplateListPageDTO {
        return new SlidesTemplateListPageDTO(
            $page->getPage(),
            $page->getPageNum(),
            array_map(
                static function (SlidesTemplateEntity $template) use ($favoriteCodes, $latestUsedAtByCode): UsedSlidesTemplatePublicListItemDTO {
                    $dto = new UsedSlidesTemplatePublicListItemDTO();
                    self::fillPublicListItemDTO($dto, $template, isset($favoriteCodes[$template->getCode()]));
                    $dto->setLatestUsedAt($latestUsedAtByCode[$template->getCode()] ?? null);
                    return $dto;
                },
                $templates
            )
        );
    }

    public static function createPublicDetailDTO(
        SlidesTemplateEntity $template,
        ?string $currentUserId = null
    ): SlidesTemplatePublicDetailDTO {
        $isOwner = $currentUserId !== null
            && $template->getOwnerType()->isUser()
            && $template->getOwnerId() === $currentUserId;
        $dto = $isOwner ? new UserSlidesTemplatePublicDetailDTO() : new SlidesTemplatePublicDetailDTO();
        $dto->setId($template->getId());
        $dto->setCode($template->getCode());
        $dto->setSourceType($template->getSourceType()->value);
        $dto->setCategoryCode($template->getCategoryCode());
        $dto->setLabel(I18nTextDTO::fromArray($template->getLabel()));
        $dto->setDescription(I18nTextDTO::fromArray($template->getDescription()));
        $dto->setThumbnailUrl($template->getThumbnailUrl());
        $dto->setColors($template->getColors());
        $dto->setCollageUrl($template->getCollageUrl());
        $dto->setPreviewImageUrls($template->getPreviewImageUrls());
        $dto->setPreviewUrl($template->getPreviewUrl());
        $dto->setSort($template->getSort());
        $dto->setUsageCount($template->getUsageCount());
        $dto->setIsOfficial(self::isOfficialTemplate($template));
        $dto->setStatus($template->getStatus()->value);
        $dto->setCreatedAt($template->getCreatedAt());
        $dto->setUpdatedAt($template->getUpdatedAt());
        if ($dto instanceof UserSlidesTemplatePublicDetailDTO && $template->getProjectId() !== null) {
            $dto->setProject($template->getProjectId(), $template->getProjectDirectoryId());
        }
        return $dto;
    }

    public static function createCountDTO(int $total, int $totalUsageCount = 0, int $templateCountTodayGrowth = 0): SlidesTemplateCountDTO
    {
        return new SlidesTemplateCountDTO($total, $totalUsageCount, $templateCountTodayGrowth);
    }

    public static function createPublicItemDTO(SlidesTemplateEntity $template): SlidesTemplatePublicItemDTO
    {
        $dto = new SlidesTemplatePublicItemDTO();
        $dto->setId($template->getId());
        $dto->setCode($template->getCode());
        $dto->setSourceType($template->getSourceType()->value);
        $dto->setCategoryCode($template->getCategoryCode());
        $dto->setLabel(I18nTextDTO::fromArray($template->getLabel()));
        $dto->setDescription(I18nTextDTO::fromArray($template->getDescription()));
        $dto->setThumbnailUrl($template->getThumbnailUrl());
        $dto->setColors($template->getColors());
        $dto->setCollageUrl($template->getCollageUrl());
        $dto->setPreviewImageUrls($template->getPreviewImageUrls());
        $dto->setPreviewUrl($template->getPreviewUrl());
        $dto->setSort($template->getSort());
        $dto->setUsageCount($template->getUsageCount());
        $dto->setIsOfficial(self::isOfficialTemplate($template));
        $dto->setStatus($template->getStatus()->value);
        $dto->setCreatedAt($template->getCreatedAt());
        $dto->setUpdatedAt($template->getUpdatedAt());
        $dto->setTags(array_map(
            static fn ($tag) => SlidesTemplateTagAssembler::createSimplePublicItemDTO($tag),
            $template->getTags()
        ));
        return $dto;
    }

    public static function createSaveUserDTO(SlidesTemplateEntity $template): SaveUserSlidesTemplateDTO
    {
        $dto = new SaveUserSlidesTemplateDTO();
        $dto->setId($template->getId());
        $dto->code = $template->getCode();
        $dto->sourceType = $template->getSourceType()->value;
        $dto->categoryCode = $template->getCategoryCode();
        $dto->setLabel($template->getLabel());
        $dto->setDescription($template->getDescription());
        $dto->thumbnailFileKey = $template->getThumbnailFileKey();
        $dto->thumbnailUrl = $template->getThumbnailUrl();
        $dto->colors = $template->getColors();
        $dto->collageFileKey = $template->getCollageFileKey();
        $dto->collageUrl = $template->getCollageUrl();
        $dto->previewImageFileKeys = $template->getPreviewImageFileKeys();
        $dto->previewImageUrls = $template->getPreviewImageUrls();
        $dto->templateFileKey = $template->getTemplateFileKey();
        $dto->previewUrl = $template->getPreviewUrl();
        $dto->status = $template->getStatus()->value;
        $dto->tags = array_map(
            static fn ($tag) => SlidesTemplateTagAssembler::createSimplePublicItemDTO($tag),
            $template->getTags()
        );
        $dto->createdAt = $template->getCreatedAt();
        $dto->updatedAt = $template->getUpdatedAt();
        return $dto;
    }

    public static function createCodeAvailabilityDTO(string $status): SlidesTemplateCodeAvailabilityDTO
    {
        return new SlidesTemplateCodeAvailabilityDTO($status);
    }

    public static function createFileUrlDTO(SlidesTemplateEntity $template): SlidesTemplateFileUrlDTO
    {
        $dto = new SlidesTemplateFileUrlDTO();
        $dto->setCode($template->getCode());
        $dto->setSourceType($template->getSourceType()->value);
        $dto->setCategoryCode($template->getCategoryCode());
        $dto->setLabel(I18nTextDTO::fromArray($template->getLabel()));
        $dto->setTemplateFileUrl($template->getTemplateFileUrl());
        return $dto;
    }

    private static function fillAdminItemDTO(AdminSlidesTemplateItemDTO $dto, SlidesTemplateEntity $template): void
    {
        $dto->setId($template->getId());
        $dto->setOrganizationCode($template->getOrganizationCode());
        $dto->setCode($template->getCode());
        $dto->setSourceType($template->getSourceType()->value);
        $dto->setCategoryCode($template->getCategoryCode());
        $dto->setLabel(I18nTextDTO::fromArray($template->getLabel()));
        $dto->setDescription(I18nTextDTO::fromArray($template->getDescription()));
        $dto->setThumbnailFileKey($template->getThumbnailFileKey());
        $dto->setThumbnailUrl($template->getThumbnailUrl());
        $dto->setColors($template->getColors());
        $dto->setCollageFileKey($template->getCollageFileKey());
        $dto->setCollageUrl($template->getCollageUrl());
        $dto->setPreviewImageFileKeys($template->getPreviewImageFileKeys());
        $dto->setPreviewImageUrls($template->getPreviewImageUrls());
        $dto->setTemplateFileKey($template->getTemplateFileKey());
        $dto->setPreviewUrl($template->getPreviewUrl());
        $dto->setStatus($template->getStatus()->value);
        $dto->setSort($template->getSort());
        $dto->setBaseUsageCount($template->getBaseUsageCount());
        $dto->setActualUsageCount($template->getActualUsageCount());
        $dto->setTotalUsageCount($template->getTotalUsageCount());
        $dto->setUsageCount($template->getUsageCount());
        $dto->setCreatedUid($template->getCreatedUid());
        $dto->setUpdatedUid($template->getUpdatedUid());
        $dto->setCreatedAt($template->getCreatedAt());
        $dto->setUpdatedAt($template->getUpdatedAt());
        $dto->setTags(array_map(
            static fn ($tag) => SlidesTemplateTagAssembler::createAdminItemDTO($tag),
            $template->getTags()
        ));
    }

    private static function fillPublicListItemDTO(
        SlidesTemplatePublicListItemDTO $dto,
        SlidesTemplateEntity $template,
        bool $isFavorite
    ): void {
        $dto->setId($template->getId());
        $dto->setCode($template->getCode());
        $dto->setSourceType($template->getSourceType()->value);
        $dto->setCategoryCode($template->getCategoryCode());
        $language = CoContext::getLanguage();
        $dto->setLabel($template->getI18nLabel($language));
        $dto->setDescription($template->getI18nDescription($language));
        $dto->setThumbnailUrl($template->getThumbnailUrl());
        $dto->setColors($template->getColors());
        $dto->setCollageUrl($template->getCollageUrl());
        $dto->setSort($template->getSort());
        $dto->setUsageCount($template->getUsageCount());
        $dto->setIsOfficial(self::isOfficialTemplate($template));
        $dto->setIsFavorite($isFavorite);
        $dto->setStatus($template->getStatus()->value);
        $dto->setCreatedAt($template->getCreatedAt());
        $dto->setUpdatedAt($template->getUpdatedAt());
        $dto->setTags(array_map(
            static function ($tag): array {
                $tagData = SlidesTemplateTagAssembler::createSimplePublicItemDTO($tag)->toArray();
                unset($tagData['name_i18n']);
                return $tagData;
            },
            $template->getTags()
        ));
    }

    private static function isOfficialTemplate(SlidesTemplateEntity $template): bool
    {
        return $template->getOwnerType()->isOfficial()
            && $template->getOwnerId() === $template->getOrganizationCode()
            && OfficialOrganizationUtil::isOfficialOrganization($template->getOrganizationCode());
    }
}
