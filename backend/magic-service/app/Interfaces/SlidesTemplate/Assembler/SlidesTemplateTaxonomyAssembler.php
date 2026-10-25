<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Assembler;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;

class SlidesTemplateTaxonomyAssembler
{
    /**
     * @param SlidesTemplateCategoryEntity[] $categories
     * @param SlidesTemplateTagEntity[] $groups
     * @return array{categories: array<int, array<string, mixed>>, groups: array<int, array<string, mixed>>, tags: array<int, array<string, mixed>>}
     */
    public static function createCatalogDTO(array $categories, array $groups): array
    {
        $groupItems = [];
        $tagItems = [];
        foreach ($groups as $group) {
            if ($group->getStatus() !== SlidesTemplateTagStatus::Enabled) {
                continue;
            }

            $enabledTags = array_values(array_filter(
                $group->getChildren(),
                static fn (SlidesTemplateTagEntity $tag): bool => $tag->getStatus() === SlidesTemplateTagStatus::Enabled
            ));
            if ($enabledTags === []) {
                continue;
            }

            $groupItems[] = [
                'code' => $group->getCode(),
                'name_i18n' => $group->getNameI18n(),
                'sort' => $group->getSort(),
            ];
            foreach ($enabledTags as $tag) {
                $tagItems[] = [
                    'code' => $tag->getCode(),
                    'group_code' => $group->getCode(),
                    'name_i18n' => $tag->getNameI18n(),
                    'sort' => $tag->getSort(),
                    'status' => $tag->getStatus()->value,
                ];
            }
        }

        return [
            'categories' => array_map(static fn (SlidesTemplateCategoryEntity $category): array => [
                'code' => $category->getCode(),
                'name_i18n' => $category->getNameI18n(),
                'sort' => $category->getSort(),
                'status' => $category->getStatus()->value,
            ], $categories),
            'groups' => $groupItems,
            'tags' => $tagItems,
        ];
    }
}
