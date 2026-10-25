<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Facade;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;

interface SlidesTemplateTagRelationRepositoryInterface
{
    /**
     * @param int[] $tagIds
     */
    public function syncTemplateTags(SlidesTemplateDataIsolation $dataIsolation, int $templateId, array $tagIds, string $createdUid): void;

    public function deleteByTemplateId(SlidesTemplateDataIsolation $dataIsolation, int $templateId): void;

    /**
     * @param int[] $templateIds
     * @param string[] $tagCodes
     * @return array<int, SlidesTemplateTagEntity[]>
     */
    public function findTagsByTemplateIds(
        SlidesTemplateDataIsolation $dataIsolation,
        array $templateIds,
        ?int $tagStatus = null,
        array $tagCodes = [],
    ): array;
}
