<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Authorization\Web;

use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;

class SandboxAuthorization extends MagicUserAuthorization
{
    public static function retrieveById($key): ?Authenticatable
    {
        $token = $key['token'] ?? '';
        $userId = $key['userId'] ?? '';
        if (empty($token) || empty($userId)) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // todo 这里以后要改成动态 token
        $sandboxToken = config('super-magic.sandbox.token', '');
        if (empty($sandboxToken) || $sandboxToken !== $token) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND, 'token error');
        }

        $userDomainService = di(MagicUserDomainService::class);
        $accountDomainService = di(MagicAccountDomainService::class);

        $userEntity = $userDomainService->getUserById($userId);
        if ($userEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }

        $magicAccountEntity = $accountDomainService->getAccountInfoByMagicId($userEntity->getMagicId());
        if ($magicAccountEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        $magicUserInfo = new self();
        $magicUserInfo->setId($userEntity->getUserId());
        $magicUserInfo->setNickname($userEntity->getNickname());
        $magicUserInfo->setAvatar($userEntity->getAvatarUrl());
        $magicUserInfo->setStatus((string) $userEntity->getStatus()->value);
        $magicUserInfo->setOrganizationCode($userEntity->getOrganizationCode());
        $magicUserInfo->setMagicId($userEntity->getMagicId());
        $magicUserInfo->setMobile($magicAccountEntity->getPhone());
        $magicUserInfo->setCountryCode($magicAccountEntity->getCountryCode());
        $magicUserInfo->setRealName($magicAccountEntity->getRealName());
        $magicUserInfo->setUserType($userEntity->getUserType());
        return $magicUserInfo;
    }
}
