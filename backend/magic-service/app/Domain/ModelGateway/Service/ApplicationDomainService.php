<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ApplicationQuery;
use App\Domain\ModelGateway\Repository\Facade\ApplicationRepositoryInterface;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class ApplicationDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly ApplicationRepositoryInterface $LLMApplicationRepository
    ) {
    }

    /**
     * @return array{total: int, list: ApplicationEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, ApplicationQuery $query, Page $page): array
    {
        return $this->LLMApplicationRepository->queries($dataIsolation, $query, $page);
    }

    public function save(LLMDataIsolation $dataIsolation, ApplicationEntity $savingLLMApplicationEntity): ApplicationEntity
    {
        if ($savingLLMApplicationEntity->shouldCreate()) {
            $LLMApplicationEntity = clone $savingLLMApplicationEntity;
            $LLMApplicationEntity->prepareForCreation();
            // code 在最组织下唯一
            if ($this->LLMApplicationRepository->getByCode($dataIsolation, $savingLLMApplicationEntity->getCode())) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.exist', ['label' => $savingLLMApplicationEntity->getCode()]);
            }
        } else {
            $LLMApplicationEntity = $this->LLMApplicationRepository->getById($dataIsolation, $savingLLMApplicationEntity->getId());
            if (! $LLMApplicationEntity) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => $savingLLMApplicationEntity->getId()]);
            }
            $savingLLMApplicationEntity->prepareForModification($LLMApplicationEntity);
        }
        return $this->LLMApplicationRepository->save($dataIsolation, $LLMApplicationEntity);
    }

    public function show(LLMDataIsolation $dataIsolation, int $id): ApplicationEntity
    {
        $LLMApplicationEntity = $this->LLMApplicationRepository->getById($dataIsolation, $id);
        if (! $LLMApplicationEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => $id]);
        }
        return $LLMApplicationEntity;
    }

    public function getByCode(LLMDataIsolation $dataIsolation, string $code): ?ApplicationEntity
    {
        $LLMApplicationEntity = $this->LLMApplicationRepository->getByCode($dataIsolation, $code);
        if (! $LLMApplicationEntity) {
            return null;
        }
        return $LLMApplicationEntity;
    }

    public function getByCodeWithNull(LLMDataIsolation $dataIsolation, string $code): ?ApplicationEntity
    {
        return $this->LLMApplicationRepository->getByCode($dataIsolation, $code);
    }

    public function destroy(LLMDataIsolation $dataIsolation, ApplicationEntity $LLMApplicationEntity): void
    {
        $this->LLMApplicationRepository->destroy($dataIsolation, $LLMApplicationEntity);
    }
}
