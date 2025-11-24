<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\AccessTokenQuery;
use App\Domain\ModelGateway\Repository\Facade\AccessTokenRepositoryInterface;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

use function Swow\defer;

class AccessTokenDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly AccessTokenRepositoryInterface $accessTokenRepository,
    ) {
    }

    public function save(LLMDataIsolation $dataIsolation, AccessTokenEntity $savingAccessTokenEntity): AccessTokenEntity
    {
        $savingAccessTokenEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $savingAccessTokenEntity->setCreator($dataIsolation->getCurrentUserId());

        if ($savingAccessTokenEntity->shouldCreate()) {
            $accessTokenEntity = clone $savingAccessTokenEntity;
            $accessTokenEntity->prepareForCreation();

            // 每种类型下，创建的数据不宜过多，这里限制一下
            if ($this->accessTokenRepository->countByTypeAndRelationId(
                $dataIsolation,
                $savingAccessTokenEntity->getType(),
                $savingAccessTokenEntity->getRelationId()
            ) > 10) {
                ExceptionBuilder::throw(MagicApiErrorCode::USER_CREATE_ACCESS_TOKEN_LIMIT);
            }
        } else {
            $accessTokenEntity = $this->accessTokenRepository->getById($dataIsolation, $savingAccessTokenEntity->getId());
            if (! $accessTokenEntity) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => $savingAccessTokenEntity->getId()]);
            }
            $savingAccessTokenEntity->prepareForModification($accessTokenEntity);
        }
        return $this->accessTokenRepository->save($dataIsolation, $accessTokenEntity);
    }

    public function show(LLMDataIsolation $dataIsolation, int $id): AccessTokenEntity
    {
        $accessTokenEntity = $this->accessTokenRepository->getById($dataIsolation, $id);
        if (! $accessTokenEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => $id]);
        }
        return $accessTokenEntity;
    }

    public function getByName(LLMDataIsolation $dataIsolation, string $name): ?AccessTokenEntity
    {
        return $this->accessTokenRepository->getByName($dataIsolation, $name);
    }

    /**
     * @return array{total: int, list: AccessTokenEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, Page $page, AccessTokenQuery $query): array
    {
        return $this->accessTokenRepository->queries($dataIsolation, $page, $query);
    }

    public function destroy(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity): void
    {
        $this->accessTokenRepository->destroy($dataIsolation, $accessTokenEntity);
    }

    public function getByAccessToken(string $getAccessToken): ?AccessTokenEntity
    {
        if (empty($getAccessToken)) {
            return null;
        }
        $encryptedAccessToken = hash('sha256', $getAccessToken);
        $dataIsolation = LLMDataIsolation::create();
        $accessToken = $this->accessTokenRepository->getByEncryptedAccessToken($dataIsolation, $encryptedAccessToken);
        if (! $accessToken) {
            return null;
        }
        $accessToken->prepareForUsed();
        defer(function () use ($accessToken): void {
            $this->accessTokenRepository->save(LLMDataIsolation::create()->disabled(), $accessToken);
        });
        return $accessToken;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, AccessTokenEntity $accessTokenEntity, float $amount): void
    {
        $this->accessTokenRepository->incrementUseAmount($dataIsolation, $accessTokenEntity, $amount);
    }
}
