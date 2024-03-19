<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\Assembler;

use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemWithPasswordDTO;

/**
 * 分享装配器
 * 负责将领域实体转换为不同类型的DTO.
 */
class ShareAssembler
{
    public function __construct(
        private ResourceShareDomainService $shareDomainService,
        private FileCollectionDomainService $fileCollectionDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private TopicDomainService $topicDomainService
    ) {
    }

    /**
     * 将分享实体转换为基础DTO.
     *
     * @param ResourceShareEntity $share 分享实体
     * @return ShareItemDTO 基础分享DTO
     */
    public function toDto(ResourceShareEntity $share): ShareItemDTO
    {
        $dto = new ShareItemDTO();
        $dto->id = (string) $share->getId();
        $dto->resourceId = $share->getResourceId();
        $dto->resourceType = $share->getResourceType();
        $dto->resourceTypeName = ResourceType::tryFrom($share->getResourceType())->name ?? '';
        $dto->shareCode = $share->getShareCode();
        $dto->hasPassword = ! empty($share->getPassword());
        $dto->shareType = $share->getShareType();
        $dto->extra = $share->getExtra() ?? [];
        $dto->defaultOpenFileId = $share->getDefaultOpenFileId() !== null ? (string) $share->getDefaultOpenFileId() : null;
        $dto->projectId = $share->getProjectId();
        $dto->resourceName = $share->getResourceName();
        $dto->shareProject = $share->isShareProject();
        $dto->shareRange = $share->getShareRange();
        $dto->targetIds = $share->getTargetIdsArray();  // 使用 getTargetIdsArray() 返回数组
        $dto->expireAt = $share->getExpireAt();
        $dto->expireDays = $share->getExpireDays();

        if ($dto->resourceType === ResourceType::Project->value) {
            $dto->resourceType = ResourceType::FileCollection->value;
            $dto->resourceTypeName = ResourceType::FileCollection->name;
            $dto->shareProject = true;
        }

        return $dto;
    }

    /**
     * 将分享实体转换为带密码的DTO.
     *
     * @param ResourceShareEntity $share 分享实体
     * @return ShareItemWithPasswordDTO 带密码的分享DTO
     */
    public function toDtoWithPassword(ResourceShareEntity $share): ShareItemWithPasswordDTO
    {
        // 先创建基础DTO
        $baseDto = $this->toDto($share);

        // 获取解密后的密码
        $password = '';
        if ($baseDto->hasPassword) {
            $password = $this->shareDomainService->getDecryptedPassword($share);
        }

        // 创建带密码的DTO
        $dto = ShareItemWithPasswordDTO::fromBaseDto($baseDto, $password);

        // 获取项目ID（所有资源类型都支持）
        // 保持旧逻辑：优先尝试动态获取（兼容旧代码）
        $projectId = $this->getProjectIdByResourceType($share->getResourceType(), $share->getResourceId());

        // 如果动态获取失败，使用数据库中的值作为兜底（兼容性问题修复）
        if ($projectId === '' || $projectId === '0') {
            $dbProjectId = $share->getProjectId();
            // 如果数据库中有有效的 project_id，使用数据库中的值
            if ($dbProjectId !== null && $dbProjectId !== '' && $dbProjectId !== '0') {
                $projectId = $dbProjectId;
            }
        }

        // 注意：project_id 可能为 "0"（字符串），需要检查是否为空字符串，而不是使用 empty()
        if ($projectId !== '' && $projectId !== '0') {
            $dto->setProjectId($projectId);
        }

        if ($share->getResourceType() === ResourceType::FileCollection->value
            || $share->getResourceType() === ResourceType::File->value) {
            // 文件集和文件类型：通过文件集ID获取文件
            $collectionId = (int) $share->getResourceId();
            $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
            $fileIds = array_map(fn ($item) => (string) $item->getFileId(), $fileCollectionItems);
            $dto->setFileIds($fileIds);

            // 获取 main_file_name
            $mainFileName = $this->getMainFileName(
                $collectionId,
                $share->getDefaultOpenFileId()
            );
            $dto->mainFileName = $mainFileName;
        } elseif ($share->getResourceType() === ResourceType::Project->value) {
            // 项目类型：通过项目ID获取文件
            $projectId = $share->getProjectId();

            // 项目ID无效，设置空值
            if ($projectId === null || $projectId === '' || $projectId === '0') {
                $dto->setFileIds([]);
                $dto->mainFileName = null;
            } else {
                // 获取项目文件列表
                $fileEntities = $this->taskFileDomainService->findUserFilesByProjectId($projectId);
                $fileIds = array_map(fn ($entity) => (string) $entity->getFileId(), $fileEntities);
                $dto->setFileIds($fileIds);

                // 获取 main_file_name
                $mainFileName = $this->getMainFileNameFromProject(
                    $fileEntities,
                    $share->getDefaultOpenFileId()
                );
                $dto->mainFileName = $mainFileName;
            }
        }

        // 验证 default_open_file_id 是否在 file_ids 中（统一处理）
        $fileIds = $dto->file_ids ?? [];
        if ($dto->defaultOpenFileId !== null) {
            if (empty($fileIds) || ! in_array($dto->defaultOpenFileId, $fileIds, true)) {
                $dto->defaultOpenFileId = null;
            }
        }

        return $dto;
    }

    /**
     * 根据资源类型获取项目ID.
     *
     * @param int $resourceType 资源类型
     * @param string $resourceId 资源ID
     * @return string 项目ID，如果无法获取则返回空字符串
     */
    private function getProjectIdByResourceType(int $resourceType, string $resourceId): string
    {
        $resourceTypeEnum = ResourceType::tryFrom($resourceType);
        if ($resourceTypeEnum === null) {
            return '';
        }

        return match ($resourceTypeEnum) {
            ResourceType::FileCollection => $this->getProjectIdFromFileCollection((int) $resourceId),
            // File类型：resource_id 是文件集ID，通过文件集获取项目ID（与 FileCollection 类型逻辑相同）
            ResourceType::File => $this->getProjectIdFromFileCollection((int) $resourceId),
            ResourceType::Topic => $this->getProjectIdFromTopic((int) $resourceId),
            // Project类型已弃用，不再支持
            default => '', // 其他类型暂不支持project_id
        };
    }

    /**
     * 从文件集获取项目ID.
     *
     * @param int $collectionId 文件集ID
     * @return string 项目ID
     */
    private function getProjectIdFromFileCollection(int $collectionId): string
    {
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($fileCollectionItems)) {
            return '';
        }

        // 文件集中的文件都属于同一个项目，取第一个文件的 project_id
        $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);
        if (empty($fileIds)) {
            return '';
        }

        $fileEntity = $this->taskFileDomainService->getById($fileIds[0]);
        if ($fileEntity === null) {
            return '';
        }

        $projectId = $fileEntity->getProjectId();
        // 如果 project_id 为 0，返回空字符串（表示无法获取项目ID）
        // 如果 project_id > 0，返回字符串形式的项目ID
        return $projectId > 0 ? (string) $projectId : '';
    }

    /**
     * 从话题资源获取项目ID.
     *
     * @param int $topicId 话题ID
     * @return string 项目ID
     */
    private function getProjectIdFromTopic(int $topicId): string
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        return $topicEntity ? (string) $topicEntity->getProjectId() : '';
    }

    /**
     * 获取主文件名（main_file_name）.
     * 逻辑：
     * 1. 如果有 default_open_file_id，使用该文件的文件名（即使为空）
     * 2. 如果没有 default_open_file_id，查找第一个非隐藏且文件名不为空的文件.
     *
     * @param int $collectionId 文件集ID
     * @param null|int $defaultOpenFileId 默认打开的文件ID
     * @return null|string 主文件名，如果无法获取则返回null
     */
    private function getMainFileName(int $collectionId, ?int $defaultOpenFileId): ?string
    {
        $targetFileName = null;
        $targetFileId = null;

        // 情况1：有 default_open_file_id
        if ($defaultOpenFileId !== null && $defaultOpenFileId > 0) {
            $targetFileId = $defaultOpenFileId;

            // 查询该文件的详细信息（包括文件名）
            $fileEntities = $this->taskFileDomainService->getFilesByIds([$targetFileId], 0);
            if (! empty($fileEntities)) {
                $targetFileName = $fileEntities[0]->getFileName();
                // 注意：即使文件名为空，也使用 default_open_file_id 指定的文件
            }
        }

        // 情况2：没有 default_open_file_id，获取文件集的第一个非隐藏文件
        if ($targetFileId === null) {
            $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
            if (! empty($fileCollectionItems)) {
                // 获取所有文件ID
                $fileIds = array_map(fn ($item) => $item->getFileId(), $fileCollectionItems);
                $fileEntities = $this->taskFileDomainService->getFilesByIds($fileIds, 0);

                // 找到第一个非隐藏且有文件名的文件
                foreach ($fileEntities as $fileEntity) {
                    if (! $fileEntity->getIsHidden()) {
                        $fileName = $fileEntity->getFileName();
                        // 如果文件名不为空，则使用该文件
                        if (! empty($fileName)) {
                            $targetFileName = $fileName;
                            break;
                        }
                        // 如果文件名为空，继续查找下一个文件
                    }
                }
            }
        }

        return $targetFileName;
    }

    /**
     * 从项目文件列表中获取主文件名（main_file_name）.
     * 逻辑：
     * 1. 如果有 default_open_file_id，使用该文件的文件名
     * 2. 如果没有 default_open_file_id，查找第一个非隐藏且文件名不为空的文件.
     *
     * @param TaskFileEntity[] $fileEntities 项目文件实体列表
     * @param null|int $defaultOpenFileId 默认打开的文件ID
     * @return null|string 主文件名，如果无法获取则返回null
     */
    private function getMainFileNameFromProject(array $fileEntities, ?int $defaultOpenFileId): ?string
    {
        // 情况1：有 default_open_file_id，查找指定文件
        if ($defaultOpenFileId !== null && $defaultOpenFileId > 0) {
            foreach ($fileEntities as $fileEntity) {
                if ($fileEntity->getFileId() === $defaultOpenFileId) {
                    return $fileEntity->getFileName();
                }
            }
        }

        // 情况2：没有 default_open_file_id 或未找到指定文件，查找第一个非隐藏且有文件名的文件
        foreach ($fileEntities as $fileEntity) {
            if (! $fileEntity->getIsHidden()) {
                $fileName = $fileEntity->getFileName();
                if (! empty($fileName)) {
                    return $fileName;
                }
            }
        }

        // 未找到合适的文件，返回 null
        return null;
    }
}
