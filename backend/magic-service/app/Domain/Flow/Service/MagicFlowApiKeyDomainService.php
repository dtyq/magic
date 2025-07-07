<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Entity\ValueObject\ApiKeyType;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowApiKeyQuery;
use App\Domain\Flow\Repository\Facade\MagicFlowApiKeyRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowApiKeyDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowApiKeyRepositoryInterface $magicFlowApiKeyRepository
    ) {
    }

    public function save(FlowDataIsolation $dataIsolation, MagicFlowApiKeyEntity $savingMagicFlowApiKeyEntity): MagicFlowApiKeyEntity
    {
        $savingMagicFlowApiKeyEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingMagicFlowApiKeyEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMagicFlowApiKeyEntity->shouldCreate()) {
            $savingMagicFlowApiKeyEntity->prepareForCreate();
            $magicFlowApiKeyEntity = $savingMagicFlowApiKeyEntity;
            // 检查是否重复，毕竟是需要一对一的关系
            /* @phpstan-ignore-next-line */
            if ($magicFlowApiKeyEntity->getType() === ApiKeyType::Personal) {
                if ($this->magicFlowApiKeyRepository->exist($dataIsolation, $magicFlowApiKeyEntity)) {
                    ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.exist', ['label' => 'flow.fields.api_key']);
                }
            }
        } else {
            $magicFlowApiKeyEntity = $this->magicFlowApiKeyRepository->getByCode($dataIsolation, $savingMagicFlowApiKeyEntity->getCode());
            if (! $magicFlowApiKeyEntity) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $savingMagicFlowApiKeyEntity->getCode()]);
            }
            $savingMagicFlowApiKeyEntity->prepareForModification($magicFlowApiKeyEntity);
        }

        return $this->magicFlowApiKeyRepository->save($dataIsolation, $magicFlowApiKeyEntity);
    }

    public function changeSecretKey(FlowDataIsolation $dataIsolation, string $code, ?string $operator = null): MagicFlowApiKeyEntity
    {
        // 只能修改自己的
        $magicFlowApiKeyEntity = $this->magicFlowApiKeyRepository->getByCode($dataIsolation, $code, $operator);
        if (! $magicFlowApiKeyEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $code]);
        }
        $magicFlowApiKeyEntity->prepareForUpdateSecretKey();
        return $this->magicFlowApiKeyRepository->save($dataIsolation, $magicFlowApiKeyEntity);
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code, ?string $operator = null): ?MagicFlowApiKeyEntity
    {
        $magicFlowApiKeyEntity = $this->magicFlowApiKeyRepository->getByCode($dataIsolation, $code, $operator);
        if (! $magicFlowApiKeyEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $code]);
        }
        return $magicFlowApiKeyEntity;
    }

    public function getBySecretKey(FlowDataIsolation $dataIsolation, string $secretKey): MagicFlowApiKeyEntity
    {
        $magicFlowApiKeyEntity = $this->magicFlowApiKeyRepository->getBySecretKey($dataIsolation, $secretKey);
        if (! $magicFlowApiKeyEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $secretKey]);
        }
        return $magicFlowApiKeyEntity;
    }

    /**
     * @return array{total: int, list: array<MagicFlowApiKeyEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFlowApiKeyQuery $query, Page $page): array
    {
        return $this->magicFlowApiKeyRepository->queries($dataIsolation, $query, $page);
    }

    public function destroy(FlowDataIsolation $dataIsolation, string $code, ?string $operator = null): void
    {
        $magicFlowApiKeyEntity = $this->magicFlowApiKeyRepository->getByCode($dataIsolation, $code, $operator);
        if (! $magicFlowApiKeyEntity) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $code]);
        }

        $this->magicFlowApiKeyRepository->destroy($dataIsolation, $magicFlowApiKeyEntity->getCode());
    }
}
