<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Authentication\Repository\Facade\AuthenticationRepositoryInterface;
use App\Domain\Authentication\Service\AuthenticationDomainService;
use App\Domain\Authentication\Service\PasswordService;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Repository\Facade\EnvironmentRepositoryInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authentication\DTO\CheckLoginRequest;
use App\Interfaces\Authentication\DTO\CheckLoginResponse;

readonly class LoginAppService
{
    public function __construct(
        protected MagicTokenRepositoryInterface $tokenRepository,
        protected EnvironmentRepositoryInterface $environmentRepository,
        protected AuthenticationDomainService $authenticationDomainService,
        protected MagicUserDomainService $userDomainService,
        protected AuthenticationRepositoryInterface $authenticationRepository,
        protected PasswordService $passwordService
    ) {
    }

    /**
     * 检查用户登录信息并颁发令牌.
     */
    public function login(CheckLoginRequest $request): CheckLoginResponse
    {
        // 验证账户信息并获取账户
        $account = $this->verifyAndGetAccount($request);

        // 验证用户在组织内是否存在
        $user = $this->verifyAndGetUserInOrganization($account, $request->getOrganizationCode());

        // 生成令牌
        $authorization = $this->authenticationDomainService->generateAccountToken($account->getMagicId());

        // 构建响应
        return $this->buildLoginResponse($authorization, $account, $user);
    }

    /**
     * 根据登录类型验证账户信息并返回账户实体.
     */
    private function verifyAndGetAccount(CheckLoginRequest $request): AccountEntity
    {
        return match ($request->getType()) {
            'phone_password' => $this->verifyPhoneAccount($request),
            default => $this->verifyEmailAccount($request),
        };
    }

    /**
     * 验证手机号登录.
     */
    private function verifyPhoneAccount(CheckLoginRequest $request): AccountEntity
    {
        $account = $this->authenticationRepository->findAccountByPhone(
            $request->getStateCode(),
            $request->getPhone()
        );

        if (! $account) {
            ExceptionBuilder::throw(AuthenticationErrorCode::AccountNotFound);
        }

        // 验证密码
        if (! $this->passwordService->verifyPassword($request->getPassword(), $account->getPassword())) {
            ExceptionBuilder::throw(AuthenticationErrorCode::PasswordError);
        }
        return $account;
    }

    /**
     * 验证邮箱登录.
     */
    private function verifyEmailAccount(CheckLoginRequest $request): AccountEntity
    {
        $account = $this->authenticationRepository->findAccountByEmail($request->getEmail());

        if (! $account) {
            ExceptionBuilder::throw(AuthenticationErrorCode::AccountNotFound);
        }

        // 验证密码
        // 使用SHA256校验密码
        if (! $this->passwordService->verifyPassword($request->getPassword(), $account->getPassword())) {
            ExceptionBuilder::throw(AuthenticationErrorCode::PasswordError);
        }
        return $account;
    }

    /**
     * 验证用户在组织内是否存在.
     */
    private function verifyAndGetUserInOrganization(AccountEntity $account, string $organizationCode): MagicUserEntity
    {
        $user = $this->authenticationDomainService->findUserInOrganization(
            $account->getMagicId(),
            $organizationCode
        );

        if (! $user) {
            ExceptionBuilder::throw(AuthenticationErrorCode::UserNotFound);
        }

        return $user;
    }

    /**
     * 构建登录响应.
     */
    private function buildLoginResponse(string $authorization, AccountEntity $account, MagicUserEntity $user): CheckLoginResponse
    {
        $response = new CheckLoginResponse();

        // 处理国家代码格式
        $stateCode = $this->formatStateCode($account->getStateCode() ?? '+86');

        // 构建用户数据
        $userData = [
            'id' => $user->getUserId(),
            'real_name' => $user->getNickname(),
            'avatar' => $user->getAvatarUrl(),
            'description' => $user->getDescription(),
            'position' => '',
            'mobile' => $account->getPhone(),
            'state_code' => $stateCode,
        ];

        // 构建响应数据
        $responseData = [
            'access_token' => $authorization,
            'bind_phone' => ! empty($account->getPhone()),
            'is_perfect_password' => false,
            'user_info' => $userData,
        ];

        $response->setData($responseData);

        return $response;
    }

    /**
     * 格式化国家代码，确保以+开头.
     */
    private function formatStateCode(string $stateCode): string
    {
        return str_starts_with($stateCode, '+') ? $stateCode : '+' . $stateCode;
    }
}
