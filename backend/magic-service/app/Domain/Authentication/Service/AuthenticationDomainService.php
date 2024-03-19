<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Service;

use App\Domain\Authentication\Repository\Facade\AuthenticationRepositoryInterface;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;

readonly class AuthenticationDomainService
{
    public function __construct(
        private AuthenticationRepositoryInterface $authenticationRepository,
        private MagicTokenRepositoryInterface $magicTokenRepository,
        private PasswordService $passwordService
    ) {
    }

    /**
     * 验证账号凭证
     */
    public function verifyAccountCredentials(string $email, string $password): ?AccountEntity
    {
        $account = $this->authenticationRepository->findAccountByEmail($email);

        if (! $account) {
            return null;
        }

        // 验证密码
        if (! $this->passwordService->verifyPassword($password, $account->getPassword())) {
            ExceptionBuilder::throw(AuthenticationErrorCode::PasswordError);
        }

        return $account;
    }

    /**
     * 在组织中查找用户.
     */
    public function findUserInOrganization(string $magicId, ?string $organizationCode = null): ?MagicUserEntity
    {
        return $this->authenticationRepository->findUserByMagicIdAndOrganization($magicId, $organizationCode);
    }

    /**
     * 生成账号令牌.
     *
     * 由于麦吉支持其他账号体系的接入，因此前端的流程的是，先去某个账号体系登录，再由麦吉做登录校验。
     * 因此，即使使用麦吉自己的账号体系，也需要遵守这个流程。
     */
    public function generateAccountToken(string $magicId): string
    {
        // 写入 token 表
        $authorization = IdGenerator::getUniqueIdSha256();
        $magicTokenEntity = new MagicTokenEntity();
        $magicTokenEntity->setType(MagicTokenType::Account);
        $magicTokenEntity->setTypeRelationValue($magicId);
        $magicTokenEntity->setToken($authorization);
        // 默认 30 天
        $carbon = Carbon::now()->addDays(30);
        $magicTokenEntity->setExpiredAt($carbon->toDateTimeString());
        $this->magicTokenRepository->createToken($magicTokenEntity);
        return $authorization;
    }
}
