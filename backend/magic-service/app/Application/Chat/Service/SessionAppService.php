<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Authentication\DTO\LoginResponseDTO;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Infrastructure\Core\Contract\Session\LoginCheckInterface;
use App\Infrastructure\Core\Contract\Session\SessionInterface;

class SessionAppService implements SessionInterface
{
    public function __construct(
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected MagicUserDomainService $magicUserDomainService
    ) {
    }

    /**
     * 登录校验.
     * @return LoginResponseDTO[]
     */
    public function LoginCheck(LoginCheckInterface $loginCheck, MagicEnvironmentEntity $magicEnvironmentEntity, ?string $magicOrganizationCode = null): array
    {
        $loginResponses = $this->magicUserDomainService->magicUserLoginCheck($loginCheck->getAuthorization(), $magicEnvironmentEntity, $magicOrganizationCode);
        // 增加组织name和头像
        if (! empty($loginResponses)) {
            // 收集所有组织代码
            $orgCodes = [];
            foreach ($loginResponses as $loginResponse) {
                $orgCode = $loginResponse->getMagicOrganizationCode();
                if (! empty($orgCode)) {
                    $orgCodes[] = $orgCode;
                }
            }

            // 如果有组织代码，批量获取所有组织的根部门信息
            if (! empty($orgCodes)) {
                // 一次性批量获取所有组织的根部门信息
                $rootDepartments = $this->magicDepartmentDomainService->getOrganizationsRootDepartment($orgCodes);

                // 填充登录响应信息
                foreach ($loginResponses as $loginResponse) {
                    $orgCode = $loginResponse->getMagicOrganizationCode();
                    if (! empty($orgCode) && isset($rootDepartments[$orgCode])) {
                        $loginResponse->setOrganizationName($rootDepartments[$orgCode]->getName() ?? '');
                    }
                }
            }
        }

        return $loginResponses;
    }
}
