<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Di\Annotation\Inject;

/**
 * 用户当前组织应用服务
 */
class MagicUserOrganizationAppService
{
    #[Inject]
    protected MagicUserDomainService $userDomainService;

    #[Inject]
    protected MagicUserSettingAppService $userSettingAppService;

    #[Inject]
    protected MagicOrganizationEnvDomainService $organizationEnvDomainService;

    /**
     * 获取用户当前组织代码
     */
    public function getCurrentOrganizationCode(string $magicId): ?array
    {
        return $this->userSettingAppService->getCurrentOrganizationDataByMagicId($magicId);
    }

    /**
     * 设置用户当前组织代码
     */
    public function setCurrentOrganizationCode(string $magicId, string $magicOrganizationCode): array
    {
        // 1. 查询用户是否在指定组织中
        $userOrganizations = $this->userDomainService->getUserOrganizationsByMagicId($magicId);
        if (! in_array($magicOrganizationCode, $userOrganizations, true)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        // 2. 查询这个组织的相关信息：magic_organizations_environment
        $organizationEnvEntity = $this->organizationEnvDomainService->getOrganizationEnvironmentByMagicOrganizationCode($magicOrganizationCode);
        if (! $organizationEnvEntity) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        // 3. 保存 magic_organization_code，origin_organization_code，environment_id，切换时间
        $organizationData = [
            'magic_organization_code' => $magicOrganizationCode,
            'third_organization_code' => $organizationEnvEntity->getOriginOrganizationCode(),
            'environment_id' => $organizationEnvEntity->getEnvironmentId(),
            'switch_time' => time(),
        ];

        $this->userSettingAppService->saveCurrentOrganizationDataByMagicId($magicId, $organizationData);
        return $organizationData;
    }
}
