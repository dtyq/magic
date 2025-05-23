<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Domain\Authentication\Entity\ValueObject\AuthenticationDataIsolation;
use App\Domain\Authentication\Entity\ValueObject\Query\ApiKeyProviderQuery;
use App\Domain\Authentication\Service\ApiKeyProviderDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class ApiKeyProviderAppService extends AbstractAuthenticationKernelAppService
{
    public function __construct(
        protected readonly ApiKeyProviderDomainService $apiKeyProviderDomainService,
    ) {
    }

    public function save(Authenticatable $authorization, ApiKeyProviderEntity $entity): ApiKeyProviderEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        $this->getRelDataOperation($dataIsolation, $entity)->validate('r', $entity->getRelCode());
        return $this->apiKeyProviderDomainService->save($dataIsolation, $entity);
    }

    public function changeSecretKey(Authenticatable $authorization, string $code): ApiKeyProviderEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        return $this->apiKeyProviderDomainService->changeSecretKey($dataIsolation, $code, $dataIsolation->getCurrentUserId());
    }

    public function getByCode(Authenticatable $authorization, string $code): ApiKeyProviderEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        return $this->apiKeyProviderDomainService->getByCode($dataIsolation, $code, $dataIsolation->getCurrentUserId());
    }

    /**
     * @return array{total: int, list: array<ApiKeyProviderEntity>}
     */
    public function queries(Authenticatable $authorization, ApiKeyProviderQuery $query, Page $page): array
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        if (empty($query->getRelType())) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ValidateFailed, 'common.empty', ['label' => 'rel_type']);
        }
        // 只能查自己的
        $query->setCreator($dataIsolation->getCurrentUserId());
        return $this->apiKeyProviderDomainService->queries($dataIsolation, $query, $page);
    }

    public function verifySecretKey(string $secretKey): ApiKeyProviderEntity
    {
        $dataIsolation = AuthenticationDataIsolation::create()->disabled();
        return $this->apiKeyProviderDomainService->verifySecretKey($dataIsolation, $secretKey);
    }

    public function destroy(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        return $this->apiKeyProviderDomainService->destroy($dataIsolation, $code, $dataIsolation->getCurrentUserId());
    }

    protected function getRelDataOperation(AuthenticationDataIsolation $dataIsolation, ApiKeyProviderEntity $entity): Operation
    {
        return match ($entity->getRelType()) {
            ApiKeyProviderType::MCP => $this->getMCPServerOperation($dataIsolation, $entity->getRelCode()),
            default => Operation::None,
        };
    }
}
