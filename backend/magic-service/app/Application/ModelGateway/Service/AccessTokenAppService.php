<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\Query\AccessTokenQuery;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class AccessTokenAppService extends AbstractLLMAppService
{
    /**
     * @return array{total: int, list: AccessTokenEntity[], users: array<string, MagicUserEntity>}
     */
    public function queries(Authenticatable $authorization, AccessTokenQuery $query, Page $page): array
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);
        $query->setCreator($dataIsolation->getCurrentUserId());
        $data = $this->accessTokenDomainService->queries($dataIsolation, $page, $query);
        $userIds = [];
        foreach ($data['list'] as $datum) {
            $userIds[] = $datum->getCreator();
            $userIds[] = $datum->getModifier();
        }
        $data['users'] = $this->getUsers($dataIsolation->getCurrentOrganizationCode(), $userIds);
        return $data;
    }

    public function show(Authenticatable $authorization, int $id): AccessTokenEntity
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);
        $accessTokenEntity = $this->accessTokenDomainService->show($dataIsolation, $id);
        if ($accessTokenEntity->getCreator() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        return $accessTokenEntity;
    }

    public function save(Authenticatable $authorization, AccessTokenEntity $savingAccessTokenEntity): AccessTokenEntity
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);
        if ($savingAccessTokenEntity->getType()->isUser()) {
            // 个人版增加关联
            $savingAccessTokenEntity->setRelationId($dataIsolation->getCurrentUserId());
        }
        if ($savingAccessTokenEntity->getType()->isApplication()) {
            // 验证应用 id 正确性
            $this->applicationDomainService->show($dataIsolation, (int) $savingAccessTokenEntity->getRelationId());
        }
        if (! $savingAccessTokenEntity->shouldCreate()) {
            $accessTokenEntity = $this->accessTokenDomainService->show($dataIsolation, $savingAccessTokenEntity->getId());
            if ($accessTokenEntity->getCreator() !== $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
            }
        }
        return $this->accessTokenDomainService->save($this->createLLMDataIsolation($authorization), $savingAccessTokenEntity);
    }

    public function destroy(Authenticatable $authorization, int $id): void
    {
        $dataIsolation = $this->createLLMDataIsolation($authorization);
        $accessTokenEntity = $this->accessTokenDomainService->show($dataIsolation, $id);
        if ($accessTokenEntity->getCreator() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        $this->accessTokenDomainService->destroy($this->createLLMDataIsolation($authorization), $accessTokenEntity);
    }
}
