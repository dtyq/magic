<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowApiKeyQuery;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowApiKeyAppService extends AbstractFlowAppService
{
    public function save(Authenticatable $authorization, MagicFlowApiKeyEntity $savingMagicFlowApiKeyEntity): MagicFlowApiKeyEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);

        $magicFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $savingMagicFlowApiKeyEntity->getFlowCode());
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::BusinessException, 'flow.common.not_found', ['label' => $savingMagicFlowApiKeyEntity->getFlowCode()]);
        }
        // 需要至少能查看，才能维护自己的 API-KEY
        $this->getFlowOperation($dataIsolation, $magicFlow)->validate('r', $savingMagicFlowApiKeyEntity->getFlowCode());
        return $this->magicFlowApiKeyDomainService->save($dataIsolation, $savingMagicFlowApiKeyEntity);
    }

    public function changeSecretKey(Authenticatable $authorization, string $flowId, string $code): MagicFlowApiKeyEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        return $this->magicFlowApiKeyDomainService->changeSecretKey($dataIsolation, $code, $authorization->getId());
    }

    public function getByCode(Authenticatable $authorization, string $flowId, string $code): ?MagicFlowApiKeyEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        return $this->magicFlowApiKeyDomainService->getByCode($dataIsolation, $code, $authorization->getId());
    }

    /**
     * @return array{total: int, list: array<MagicFlowApiKeyEntity>}
     */
    public function queries(Authenticatable $authorization, MagicFlowApiKeyQuery $query, Page $page): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        return $this->magicFlowApiKeyDomainService->queries($dataIsolation, $query, $page);
    }

    public function destroy(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $this->magicFlowApiKeyDomainService->destroy($dataIsolation, $code, $authorization->getId());
    }
}
