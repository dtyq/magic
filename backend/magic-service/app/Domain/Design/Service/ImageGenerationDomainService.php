<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Service;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationStatus;
use App\Domain\Design\Event\ImageGenerationTaskCreatedEvent;
use App\Domain\Design\Repository\Facade\ImageGenerationRepositoryInterface;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\AsyncEvent\AsyncEventUtil;

/**
 * 图片生成领域服务
 */
readonly class ImageGenerationDomainService
{
    public function __construct(
        private ImageGenerationRepositoryInterface $repository
    ) {
    }

    /**
     * 创建生图任务
     */
    public function createTask(DesignDataIsolation $dataIsolation, ImageGenerationEntity $entity): void
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setUserId($dataIsolation->getCurrentUserId());

        $entity->prepareForCreate();

        // 检查 image_id 是否存在，因为要唯一
        if ($this->queryByProjectAndImageId($dataIsolation, $entity->getProjectId(), $entity->getImageId())) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.image_id_exists', ['image_id' => $entity->getImageId()]);
        }
        $this->repository->create($dataIsolation, $entity);
        AsyncEventUtil::dispatch(new ImageGenerationTaskCreatedEvent($entity));
    }

    /**
     * 根据 project_id 和 image_id 查询任务
     */
    public function queryByProjectAndImageId(DesignDataIsolation $dataIsolation, int $projectId, string $imageId): ?ImageGenerationEntity
    {
        return $this->repository->findByProjectAndImageId($dataIsolation, $projectId, $imageId);
    }

    /**
     * 更新任务状态为处理中.
     */
    public function markAsProcessing(DesignDataIsolation $dataIsolation, int $taskId): void
    {
        $this->repository->updateStatus($dataIsolation, $taskId, ImageGenerationStatus::PROCESSING->value);
    }

    /**
     * 更新任务状态为已完成.
     */
    public function markAsCompleted(DesignDataIsolation $dataIsolation, int $taskId, string $fileName): void
    {
        $this->repository->completed($dataIsolation, $taskId, $fileName);
    }

    /**
     * 更新任务状态为失败.
     */
    public function markAsFailed(DesignDataIsolation $dataIsolation, int $taskId, string $errorMessage): void
    {
        $this->repository->updateStatus($dataIsolation, $taskId, ImageGenerationStatus::FAILED->value, $errorMessage);
    }
}
