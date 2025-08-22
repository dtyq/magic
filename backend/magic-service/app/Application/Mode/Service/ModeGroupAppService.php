<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Exception;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

class ModeGroupAppService extends AbstractModeAppService
{
    public function __construct(
        private ModeGroupDomainService $groupDomainService,
        FileDomainService $fileDomainService,
        private LoggerInterface $logger
    ) {
        $this->fileDomainService = $fileDomainService;
    }

    /**
     * 根据模式ID获取分组列表.
     */
    public function getGroupsByModeId(MagicUserAuthorization $authorization, string $modeId): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $groups = $this->groupDomainService->getGroupsByModeId($dataIsolation, $modeId);

        $groupDTOs = ModeAssembler::groupEntitiesToDTOs($groups);

        // 处理分组图标
        $this->processGroupIcons($authorization, $groupDTOs);

        return $groupDTOs;
    }

    /**
     * 获取分组详情.
     */
    public function getGroupById(MagicUserAuthorization $authorization, string $groupId): ?array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $group = $this->groupDomainService->getGroupById($dataIsolation, $groupId);

        if (! $group) {
            return null;
        }

        $models = $this->groupDomainService->getGroupModels($dataIsolation, $groupId);
        $groupDTO = ModeAssembler::groupEntityToDTO($group);
        $relationDTOs = ModeAssembler::relationEntitiesToDTOs($models);

        return [
            'group' => $groupDTO->toArray(),
            'models' => $relationDTOs,
        ];
    }

    /**
     * 创建分组.
     */
    public function createGroup(MagicUserAuthorization $authorization, ModeGroupDTO $groupDTO): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $groupEntity = ModeAssembler::groupDTOToEntity($groupDTO);
            $groupEntity->setOrganizationCode($authorization->getOrganizationCode());
            $groupEntity->setCreatorId($authorization->getId());

            $savedGroup = $this->groupDomainService->createGroup($dataIsolation, $groupEntity);

            Db::commit();

            return ModeAssembler::groupEntityToDTO($savedGroup)->toArray();
        } catch (Exception $exception) {
            $this->logger->warning('Create mode group failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新分组.
     */
    public function updateGroup(MagicUserAuthorization $authorization, ModeGroupDTO $groupDTO): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            // 先获取现有分组
            $existingGroup = $this->groupDomainService->getGroupById($dataIsolation, $groupDTO->getId());
            if (! $existingGroup) {
                throw new InvalidArgumentException('Group not found');
            }

            // 只更新允许修改的字段
            $existingGroup->setName($groupDTO->getName());
            $existingGroup->setIcon($groupDTO->getIcon() ?? '');
            $existingGroup->setColor($groupDTO->getColor() ?? '');
            $existingGroup->setDescription($groupDTO->getDescription() ?? '');
            $existingGroup->setSort($groupDTO->getSort());
            $existingGroup->setStatus($groupDTO->getStatus());

            $updatedGroup = $this->groupDomainService->updateGroup($dataIsolation, $existingGroup);

            Db::commit();

            return ModeAssembler::groupEntityToDTO($updatedGroup)->toArray();
        } catch (Exception $exception) {
            $this->logger->warning('Update mode group failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 删除分组.
     */
    public function deleteGroup(MagicUserAuthorization $authorization, string $groupId): void
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $success = $this->groupDomainService->deleteGroup($dataIsolation, $groupId);
            if (! $success) {
                throw new InvalidArgumentException('Failed to delete group');
            }

            Db::commit();
        } catch (Exception $exception) {
            $this->logger->warning('Delete mode group failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }
}
