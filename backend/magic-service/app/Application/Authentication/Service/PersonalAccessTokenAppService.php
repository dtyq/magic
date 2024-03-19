<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Service\MagicTokenDomainService;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Qbhy\HyperfAuth\Authenticatable;

class PersonalAccessTokenAppService extends AbstractAuthenticationKernelAppService
{
    public function __construct(
        protected readonly MagicTokenDomainService $magicTokenDomainService,
    ) {
    }

    public function createToken(Authenticatable $authorization): MagicTokenEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        $userId = $dataIsolation->getCurrentUserId();

        $existingToken = $this->magicTokenDomainService->getTokenByTypeAndRelationValue(MagicTokenType::PersonalAccessToken, $userId);
        if ($existingToken !== null) {
            ExceptionBuilder::throw(AuthenticationErrorCode::PersonalAccessTokenAlreadyExists);
        }

        return $this->doCreateToken($userId);
    }

    public function resetToken(Authenticatable $authorization): MagicTokenEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        $userId = $dataIsolation->getCurrentUserId();

        $existingToken = $this->magicTokenDomainService->getTokenByTypeAndRelationValue(MagicTokenType::PersonalAccessToken, $userId);
        if ($existingToken !== null) {
            $this->magicTokenDomainService->deleteToken($existingToken);
        }

        return $this->doCreateToken($userId);
    }

    public function getTokenInfo(Authenticatable $authorization): ?MagicTokenEntity
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        return $this->magicTokenDomainService->getTokenByTypeAndRelationValue(MagicTokenType::PersonalAccessToken, $dataIsolation->getCurrentUserId());
    }

    public function deleteToken(Authenticatable $authorization): bool
    {
        $dataIsolation = $this->createAuthenticationDataIsolation($authorization);
        $token = $this->magicTokenDomainService->getTokenByTypeAndRelationValue(MagicTokenType::PersonalAccessToken, $dataIsolation->getCurrentUserId());
        if ($token !== null) {
            $this->magicTokenDomainService->deleteToken($token);
        }
        return true;
    }

    private function doCreateToken(string $userId): MagicTokenEntity
    {
        $randomPart = bin2hex(random_bytes(32));
        $token = 'pat_' . $randomPart;
        $expiredAt = date('Y-m-d H:i:s', strtotime('+1 year'));

        $tokenEntity = new MagicTokenEntity();
        $tokenEntity->setType(MagicTokenType::PersonalAccessToken);
        $tokenEntity->setTypeRelationValue($userId);
        $tokenEntity->setToken($token);
        $tokenEntity->setExpiredAt($expiredAt);

        $this->magicTokenDomainService->createToken($tokenEntity);

        return $tokenEntity;
    }
}
