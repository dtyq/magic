<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Factory;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateModel;

class SlidesTemplateFactory
{
    public static function modelToEntity(SlidesTemplateModel $model): SlidesTemplateEntity
    {
        $entity = new SlidesTemplateEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setOwnerType($model->owner_type ?? null);
        $entity->setOwnerId($model->owner_id ?? null);
        $entity->setProjectId($model->project_id);
        $entity->setProjectDirectoryId($model->project_directory_id);
        $entity->setCode($model->code);
        $entity->setSourceType($model->source_type ?? null);
        $entity->setCategoryCode($model->category_code ?? null);
        $entity->setLabel($model->label ?? []);
        $entity->setDescription($model->description ?? []);
        $entity->setSearchText($model->search_text);
        $entity->setThumbnailFileKey($model->thumbnail_file_key);
        $entity->setColors($model->colors ?? []);
        $entity->setCollageFileKey($model->collage_file_key);
        $entity->setPreviewImageFileKeys($model->preview_image_file_keys ?? []);
        $entity->setTemplateFileKey($model->template_file_key);
        $entity->setPreviewUrl($model->preview_url);
        $entity->setStatus($model->status);
        $entity->setSort($model->sort);
        $entity->setBaseUsageCount($model->base_usage_count ?? 0);
        $entity->setActualUsageCount($model->actual_usage_count ?? 0);
        $entity->setTotalUsageCount($model->total_usage_count ?? $entity->getBaseUsageCount() + $entity->getActualUsageCount());
        $entity->setCreatedUid($model->created_uid);
        $entity->setUpdatedUid($model->updated_uid);
        $entity->setCreatedAt($model->created_at?->toDateTimeString());
        $entity->setUpdatedAt($model->updated_at?->toDateTimeString());
        $entity->setDeletedAt($model->deleted_at?->toDateTimeString());
        return $entity;
    }
}
