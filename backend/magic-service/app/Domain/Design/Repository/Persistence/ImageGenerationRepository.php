<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Repository\Persistence;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationStatus;
use App\Domain\Design\Factory\ImageGenerationFactory;
use App\Domain\Design\Repository\Facade\ImageGenerationRepositoryInterface;
use App\Domain\Design\Repository\Persistence\Model\ImageGenerationModel;

/**
 * 图片生成任务仓储实现.
 */
class ImageGenerationRepository extends DesignAbstractRepository implements ImageGenerationRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    /**
     * 创建生图任务
     */
    public function create(DesignDataIsolation $dataIsolation, ImageGenerationEntity $entity): void
    {
        $model = new ImageGenerationModel();
        $model->fill($this->getAttributes($entity));
        $model->save();
        $entity->setId($model->id);
    }

    /**
     * 根据 ID 查询任务
     */
    public function findById(DesignDataIsolation $dataIsolation, int $id): ?ImageGenerationEntity
    {
        $builder = $this->createBuilder($dataIsolation, ImageGenerationModel::query());
        /** @var ImageGenerationModel $model */
        $model = $builder->where('id', $id)->first();

        if ($model === null) {
            return null;
        }
        return ImageGenerationFactory::modelToEntity($model);
    }

    /**
     * 根据 project_id 和 image_id 查询任务
     */
    public function findByProjectAndImageId(DesignDataIsolation $dataIsolation, int $projectId, string $imageId): ?ImageGenerationEntity
    {
        $builder = $this->createBuilder($dataIsolation, ImageGenerationModel::query());
        /** @var ImageGenerationModel $model */
        $model = $builder->where('project_id', $projectId)
            ->where('image_id', $imageId)
            ->first();

        if ($model === null) {
            return null;
        }

        return ImageGenerationFactory::modelToEntity($model);
    }

    /**
     * 更新任务状态
     */
    public function updateStatus(DesignDataIsolation $dataIsolation, int $id, string $status, ?string $errorMessage = null): void
    {
        $data = [
            'status' => $status,
        ];

        if ($errorMessage !== null) {
            // 截断错误信息，确保不超过数据库字段长度 (512)
            $data['error_message'] = mb_substr($errorMessage, 0, 512);
        }

        $builder = $this->createBuilder($dataIsolation, ImageGenerationModel::query());
        $builder->where('id', $id)->update($data);
    }

    public function completed(DesignDataIsolation $dataIsolation, int $id, string $fileName): void
    {
        $data = [
            'status' => ImageGenerationStatus::COMPLETED->value,
            'file_name' => $fileName,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $builder = $this->createBuilder($dataIsolation, ImageGenerationModel::query());
        $builder->where('id', $id)->update($data);
    }
}
