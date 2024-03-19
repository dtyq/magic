<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowTriggerTestcaseQuery;
use App\Domain\Flow\Repository\Facade\MagicFlowTriggerTestcaseRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowTriggerTestcaseDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowTriggerTestcaseRepositoryInterface $magicFlowTriggerTestcaseRepository,
    ) {
    }

    /**
     * 保存测试集.
     */
    public function save(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $savingMagicFlowTriggerTestcaseEntity): MagicFlowTriggerTestcaseEntity
    {
        $savingMagicFlowTriggerTestcaseEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingMagicFlowTriggerTestcaseEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMagicFlowTriggerTestcaseEntity->shouldCreate()) {
            $magicFlowTriggerTestcaseEntity = clone $savingMagicFlowTriggerTestcaseEntity;
            $magicFlowTriggerTestcaseEntity->prepareForCreation();
        } else {
            $magicFlowTriggerTestcaseEntity = $this->magicFlowTriggerTestcaseRepository->getByFlowCodeAndCode($dataIsolation, $savingMagicFlowTriggerTestcaseEntity->getFlowCode(), $savingMagicFlowTriggerTestcaseEntity->getCode());
            if (! $magicFlowTriggerTestcaseEntity) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$savingMagicFlowTriggerTestcaseEntity->getCode()} 不存在");
            }
            $savingMagicFlowTriggerTestcaseEntity->prepareForModification($magicFlowTriggerTestcaseEntity);
        }

        return $this->magicFlowTriggerTestcaseRepository->save($dataIsolation, $magicFlowTriggerTestcaseEntity);
    }

    /**
     * 查询测试集.
     * @return array{total: int, list: array<MagicFlowTriggerTestcaseEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowTriggerTestcaseQuery $query, Page $page): array
    {
        return $this->magicFlowTriggerTestcaseRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 删除测试集.
     */
    public function remove(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): void
    {
        $this->magicFlowTriggerTestcaseRepository->remove($dataIsolation, $magicFlowTriggerTestcaseEntity);
    }

    /**
     * 获取测试集详情.
     */
    public function show(FlowDataIsolation $dataIsolation, string $flowCode, string $testcaseCode): MagicFlowTriggerTestcaseEntity
    {
        $testcase = $this->magicFlowTriggerTestcaseRepository->getByFlowCodeAndCode($dataIsolation, $flowCode, $testcaseCode);
        if (! $testcase) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$testcaseCode} 不存在");
        }
        return $testcase;
    }
}
