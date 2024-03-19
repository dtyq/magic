<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Permission;

use App\Domain\Contact\Service\MagicAccountDomainService;
use Hyperf\Di\Annotation\Inject;

class Permission implements PermissionInterface
{
    #[Inject]
    protected MagicAccountDomainService $magicAccountDomainService;

    /**
     * 判断是否超级管理员.
     *
     * @param string $organizationCode 组织编码
     * @param string $mobile 手机号
     *
     * @return bool 是否超级管理员
     */
    public function isOrganizationAdmin(string $organizationCode, string $mobile): bool
    {
        $whiteMap = config('permission.organization_whitelists');
        if (empty($whiteMap)
            || ! isset($whiteMap[$organizationCode])
            || ! in_array($mobile, $whiteMap[$organizationCode])
        ) {
            return false;
        }
        return true;
    }

    /**
     * 获取该用手机号码下所拥有的组织管理员代码.
     */
    public function getOrganizationAdminList(string $magicId): array
    {
        // 通过 magicID 获取手机号码
        $accountEntity = $this->magicAccountDomainService->getAccountInfoByMagicId($magicId);
        if ($accountEntity === null) {
            return [];
        }

        $mobile = $accountEntity->getPhone();
        $whiteMap = config('permission.organization_whitelists');
        if (empty($whiteMap) || empty($mobile)) {
            return [];
        }

        $organizationCodes = [];
        foreach ($whiteMap as $organizationCode => $mobileList) {
            if (is_array($mobileList) && in_array($mobile, $mobileList)) {
                $organizationCodes[] = $organizationCode;
            }
        }

        return $organizationCodes;
    }
}
