<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Flow\Event\MagicFLowToolSetSavedEvent;
use App\Domain\Flow\Repository\Facade\MagicFlowToolSetRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\AsyncEvent\AsyncEventUtil;

class MagicFlowToolSetDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowToolSetRepositoryInterface $magicFlowToolSetRepository,
    ) {
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): MagicFlowToolSetEntity
    {
        if ($code === ConstValue::TOOL_SET_DEFAULT_CODE) {
            return MagicFlowToolSetEntity::createNotGrouped($dataIsolation->getCurrentOrganizationCode());
        }
        $toolSet = $this->magicFlowToolSetRepository->getByCode($dataIsolation, $code);
        if (! $toolSet) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $code]);
        }
        return $toolSet;
    }

    public function save(FlowDataIsolation $dataIsolation, MagicFlowToolSetEntity $savingMagicFLowToolSetEntity): MagicFlowToolSetEntity
    {
        $savingMagicFLowToolSetEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingMagicFLowToolSetEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMagicFLowToolSetEntity->shouldCreate()) {
            $magicFlowToolSetEntity = clone $savingMagicFLowToolSetEntity;
            $magicFlowToolSetEntity->prepareForCreation();
        } else {
            if ($savingMagicFLowToolSetEntity->getCode() === ConstValue::TOOL_SET_DEFAULT_CODE) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.tool_set.not_edit_default_tool_set');
            }
            $magicFlowToolSetEntity = $this->magicFlowToolSetRepository->getByCode($dataIsolation, $savingMagicFLowToolSetEntity->getCode());
            if (! $magicFlowToolSetEntity) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $savingMagicFLowToolSetEntity->getCode()]);
            }
            $savingMagicFLowToolSetEntity->prepareForModification($magicFlowToolSetEntity);
        }
        $toolSet = $this->magicFlowToolSetRepository->save($dataIsolation, $magicFlowToolSetEntity);
        AsyncEventUtil::dispatch(new MagicFLowToolSetSavedEvent($toolSet, $savingMagicFLowToolSetEntity->shouldCreate()));
        return $toolSet;
    }

    public function create(FlowDataIsolation $dataIsolation, MagicFlowToolSetEntity $savingMagicFLowToolSetEntity): MagicFlowToolSetEntity
    {
        $toolSet = $this->magicFlowToolSetRepository->save($dataIsolation, $savingMagicFLowToolSetEntity);
        $savedEvent = new MagicFLowToolSetSavedEvent($toolSet, true);
        AsyncEventUtil::dispatch($savedEvent);
        return $toolSet;
    }

    /**
     * @return array{total: int, list: array<MagicFlowToolSetEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowToolSetQuery $query, Page $page): array
    {
        return $this->magicFlowToolSetRepository->queries($dataIsolation, $query, $page);
    }

    public function destroy(FlowDataIsolation $dataIsolation, string $code): void
    {
        $toolSet = $this->magicFlowToolSetRepository->getByCode($dataIsolation, $code);
        if (! $toolSet) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.common.not_found', ['label' => $code]);
        }
        $this->magicFlowToolSetRepository->destroy($dataIsolation, $code);
    }
}
