<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeDTO;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Exception;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

class ModeAppService extends AbstractModeAppService
{
    public function __construct(
        private ModeDomainService $modeDomainService,
        private ProviderModelDomainService $providerModelDomainService,
        FileDomainService $fileDomainService,
        private LoggerInterface $logger
    ) {
        $this->fileDomainService = $fileDomainService;
    }

    /**
     * 获取模式列表.
     */
    public function getModes(MagicUserAuthorization $authorization, Page $page): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $result = $this->modeDomainService->getModes($dataIsolation, $page);

        return [
            'total' => $result['total'],
            'list' => array_map(fn ($mode) => ModeAssembler::modeToDTO($mode), $result['list']),
        ];
    }

    /**
     * 根据ID获取模式聚合根（包含模式详情、分组、模型关系）.
     */
    public function getModeById(MagicUserAuthorization $authorization, string $id): ModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $id);

        if (! $modeAggregate) {
            throw new InvalidArgumentException('Mode not found');
        }

        // 获取所有模型ID
        $allModelIds = [];
        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $allModelIds[] = (string) $relation->getModelId();
            }
        }

        // 批量获取模型信息
        $providerModels = [];
        if (! empty($allModelIds)) {
            $providerDataIsolation = new ProviderDataIsolation($authorization->getOrganizationCode());
            $providerModels = $this->providerModelDomainService->getModelsByIds($providerDataIsolation, $allModelIds);
        }

        // 转换为DTO
        $modeAggregateDTO = ModeAssembler::aggregateToDTO($modeAggregate, $providerModels);

        // 处理icon
        $this->processModeAggregateIcons($authorization, $modeAggregateDTO);

        return $modeAggregateDTO;
    }

    /**
     * 创建模式.
     */
    public function createMode(MagicUserAuthorization $authorization, ModeDTO $modeDTO): ModeDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $modeEntity = ModeAssembler::modelDTOToEntity($modeDTO);
            $savedMode = $this->modeDomainService->createMode($dataIsolation, $modeEntity);

            Db::commit();

            $modeEntity = $this->modeDomainService->getModeById($dataIsolation, $savedMode->getId());
            return ModeAssembler::modeToDTO($modeEntity);
        } catch (Exception $exception) {
            $this->logger->warning('Create mode failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新模式.
     */
    public function updateMode(MagicUserAuthorization $authorization, ModeDTO $modeDTO): ModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $modeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $modeDTO->getId());
            if (! $modeAggregate) {
                throw new InvalidArgumentException('Mode not found');
            }

            $updatedEntity = ModeAssembler::modelDTOToEntity($modeDTO);
            $updatedMode = $this->modeDomainService->updateMode($dataIsolation, $updatedEntity);

            Db::commit();

            // 重新获取聚合根信息
            $updatedModeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $updatedMode->getId());
            return ModeAssembler::aggregateToDTO($updatedModeAggregate);
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
    public function getDefaultMode(MagicUserAuthorization $authorization): ?ModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $defaultModeAggregate = $this->modeDomainService->getDefaultMode($dataIsolation);

        return $defaultModeAggregate ? ModeAssembler::aggregateToDTO($defaultModeAggregate) : null;
    }

    /**
     * 获取启用的模式列表.
     */
    public function getEnabledModes(MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modes = $this->modeDomainService->getModes($dataIsolation, new Page(1, 100))['list'];

        $enabledModes = array_filter($modes, fn ($mode) => $mode->isEnabled());

        return array_map(fn ($mode) => ModeAssembler::modeToDTO($mode), $enabledModes);
    }

    /**
     * 保存模式配置.
     */
    public function saveModeConfig(MagicUserAuthorization $authorization, ModeAggregateDTO $modeAggregateDTO): ModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            // 将DTO转换为领域对象
            $modeAggregateEntity = ModeAssembler::aggregateDTOToEntity($modeAggregateDTO);

            $modeAggregate = $this->modeDomainService->saveModeConfig($dataIsolation, $modeAggregateEntity);

            Db::commit();

            return ModeAssembler::aggregateToDTO($modeAggregate);
        } catch (Exception $exception) {
            $this->logger->warning('Save mode config failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }
}
