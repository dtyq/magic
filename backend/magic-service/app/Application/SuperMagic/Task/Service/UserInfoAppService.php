<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\SuperMagic\Task\DTO\UserAccountDataStatus;
use App\Application\SuperMagic\Task\DTO\UserAccountDTO;
use App\Application\SuperMagic\Task\DTO\UserInfoDTO;
use App\Application\SuperMagic\Task\DTO\UserPointsDTO;
use App\Application\SuperMagic\Task\DTO\UserSubscriptionDTO;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTimeImmutable;
use DateTimeZone;

class UserInfoAppService
{
    public function __construct(
        private readonly MagicUserInfoAppService $userInfoAppService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly OrganizationDomainService $organizationDomainService,
    ) {
    }

    /**
     * @param list<string> $includeSensitiveFields
     */
    public function getUserInfo(MagicUserAuthorization $authorization, array $includeSensitiveFields = []): UserInfoDTO
    {
        $user = $this->userDomainService->getUserById($authorization->getId());
        if ($user === null || $user->getOrganizationCode() !== $authorization->getOrganizationCode()
            || $user->getMagicId() !== $authorization->getMagicId()) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }

        // 只读资料查询无需创建沙盒授权；隔离范围直接来自已认证用户。
        $isolation = new DataIsolation();
        $isolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $isolation->setCurrentUserId($authorization->getId());
        $isolation->setCurrentMagicId($authorization->getMagicId());
        $isolation->setUserType($authorization->getUserType());

        $profile = $this->userInfoAppService->getUserInfo($authorization->getId(), $isolation);
        $organization = $this->organizationDomainService->getByCode($authorization->getOrganizationCode());
        if ($organization === null) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }
        $phone = $profile['phone'];
        if (! in_array('phone', $includeSensitiveFields, true)) {
            $phone = self::maskPhone($phone);
        }

        return new UserInfoDTO(
            capturedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            id: $authorization->getId(),
            magicId: $authorization->getMagicId(),
            nickname: $profile['nickname'],
            realName: $profile['real_name'],
            avatarUrl: $profile['avatar_url'],
            workNumber: $profile['work_number'],
            position: $profile['position'],
            email: $profile['email'],
            phone: $phone,
            departments: $profile['departments'],
            organizationCode: $authorization->getOrganizationCode(),
            organizationName: $organization->getName(),
            account: $this->getAccountInfo($authorization),
            thirdPlatformId: $profile['third_platform_id'] ?? '',
        );
    }

    protected function getAccountInfo(MagicUserAuthorization $authorization): UserAccountDTO
    {
        // 未接入商业能力不等于免费套餐或零余额。
        return new UserAccountDTO(
            new UserSubscriptionDTO(UserAccountDataStatus::Unsupported),
            new UserPointsDTO(UserAccountDataStatus::Unsupported),
        );
    }

    private static function maskPhone(string $phone): string
    {
        if ($phone === '') {
            return '';
        }
        $phone = trim($phone);
        return mb_strlen($phone) <= 7 ? '****' : mb_substr($phone, 0, 3) . '****' . mb_substr($phone, -4);
    }
}
