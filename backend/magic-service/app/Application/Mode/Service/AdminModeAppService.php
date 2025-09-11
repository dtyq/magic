<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\AdminModeAssembler;
use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;
use Exception;
use Hyperf\DbConnection\Db;

class AdminModeAppService extends AbstractModeAppService
{
    /**
     * 获取模式列表 (管理后台用，包含完整i18n字段).
     */
    public function getModes(MagicUserAuthorization $authorization, Page $page): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        // 管理后台查询：sort降序，不过滤默认模式
        $query = new ModeQuery('desc', false);
        $result = $this->modeDomainService->getModes($dataIsolation, $query, $page);

        return [
            'total' => $result['total'],
            'list' => AdminModeAssembler::entitiesToAdminDTOs($result['list']),
        ];
    }

    /**
     * 根据ID获取模式聚合根（包含模式详情、分组、模型关系）.
     */
    public function getModeById(MagicUserAuthorization $authorization, string $id): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $id);

        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        $providerModels = $this->getDetailedModels($modeAggregate);

        // 转换为DTO
        $modeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($modeAggregate, $providerModels);

        // 处理icon
        $this->processModeAggregateIcons($modeAggregateDTO);

        return $modeAggregateDTO;
    }

    public function getOriginMode(MagicUserAuthorization $authorization, string $id): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modeAggregate = $this->modeDomainService->getOriginMode($dataIsolation, $id);
        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }
        $providerModels = $this->getDetailedModels($modeAggregate);
        // 转换为DTO
        $modeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($modeAggregate, $providerModels);

        // 处理icon
        $this->processModeAggregateIcons($modeAggregateDTO);

        return $modeAggregateDTO;
    }

    /**
     * 创建模式 (管理后台用).
     */
    public function createMode(MagicUserAuthorization $authorization, CreateModeRequest $request): AdminModeDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $modeEntity = AdminModeAssembler::createModeRequestToEntity(
                $request
            );
            $savedMode = $this->modeDomainService->createMode($dataIsolation, $modeEntity);

            Db::commit();

            $modeEntity = $this->modeDomainService->getModeById($dataIsolation, $savedMode->getId());
            return AdminModeAssembler::modeToAdminDTO($modeEntity);
        } catch (Exception $exception) {
            $this->logger->warning('Create mode failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新模式.
     */
    public function updateMode(MagicUserAuthorization $authorization, string $modeId, UpdateModeRequest $request): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        // 先获取现有的完整实体
        $existingMode = $this->modeDomainService->getModeById($dataIsolation, $modeId);
        if (! $existingMode) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        Db::beginTransaction();
        try {
            // 将更新请求应用到现有实体（只更新允许修改的字段）
            AdminModeAssembler::applyUpdateRequestToEntity($request, $existingMode);

            $updatedMode = $this->modeDomainService->updateMode($dataIsolation, $existingMode);

            Db::commit();

            // 重新获取聚合根信息
            $updatedModeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $updatedMode->getId());
            return AdminModeAssembler::aggregateToAdminDTO($updatedModeAggregate);
        } catch (Exception $exception) {
            $this->logger->warning('Update mode failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新模式状态
     */
    public function updateModeStatus(MagicUserAuthorization $authorization, string $id, bool $status): bool
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        try {
            return $this->modeDomainService->updateModeStatus($dataIsolation, $id, $status);
        } catch (Exception $exception) {
            $this->logger->warning('Update mode status failed: ' . $exception->getMessage());
            throw $exception;
        }
    }

    /**
     * 获取默认模式.
     */
    public function getDefaultMode(MagicUserAuthorization $authorization): ?AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $defaultModeAggregate = $this->modeDomainService->getDefaultMode($dataIsolation);
        $providerModels = $this->getDetailedModels($defaultModeAggregate);

        $adminModeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($defaultModeAggregate, $providerModels);

        $this->processModeAggregateIcons($adminModeAggregateDTO);

        return $adminModeAggregateDTO;
    }

    /**
     * 保存模式配置.
     */
    public function saveModeConfig(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            // 将DTO转换为领域对象
            $modeAggregateEntity = AdminModeAssembler::aggregateDTOToEntity($modeAggregateDTO);

            $this->modeDomainService->saveModeConfig($dataIsolation, $modeAggregateEntity);

            Db::commit();

            return $this->getModeById($authorization, $modeAggregateDTO->getMode()->getId());
        } catch (Exception $exception) {
            $this->logger->warning('Save mode config failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }
}
