<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Factory;

use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationStatus;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Repository\Persistence\Model\ImageGenerationModel;

/**
 * 图片生成任务工厂
 */
class ImageGenerationFactory
{
    /**
     * 从模型转换为实体.
     */
    public static function modelToEntity(ImageGenerationModel $model): ImageGenerationEntity
    {
        $entity = new ImageGenerationEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setUserId($model->user_id);
        $entity->setProjectId($model->project_id);
        $entity->setImageId($model->image_id);
        $entity->setModelId($model->model_id);
        $entity->setPrompt($model->prompt);
        $entity->setSize($model->size);
        $entity->setResolution($model->resolution);
        $entity->setFileDir($model->file_dir);
        $entity->setFileName($model->file_name);
        $entity->setReferenceImages($model->reference_images);
        $entity->setReferenceImageOptions($model->reference_image_options);
        $entity->setType(ImageGenerationType::make($model->type));
        $entity->setStatus(ImageGenerationStatus::from($model->status));
        $entity->setErrorMessage($model->error_message);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
