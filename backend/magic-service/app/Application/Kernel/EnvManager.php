<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\DataIsolationInitializerInterface;
use Hyperf\Context\Context;

/** 保留静态调用兼容入口，实际能力准备统一委托初始化器。 */
class EnvManager
{
    /** 旧入口仅为完全空身份保留当前请求上下文继承，不覆盖显式身份。 */
    public static function initDataIsolationEnv(BaseDataIsolation $baseDataIsolation, int $envId = 0, bool $force = false): void
    {
        $last = Context::get('LastBaseDataIsolationInitEnv');
        if (! $force && $envId === 0 && $baseDataIsolation->getEnvId() === 0
            && $baseDataIsolation->getCurrentOrganizationCode() === '' && $baseDataIsolation->getCurrentUserId() === ''
            && $last instanceof BaseDataIsolation) {
            $baseDataIsolation->extends($last);
        }
        $baseDataIsolation->initDataIsolationEnv($envId, $force);
        if ($baseDataIsolation->getEnvId() !== 0) {
            // 只有旧静态入口维护请求身份继承，新对象入口不修改该状态。
            Context::set('LastBaseDataIsolationInitEnv', $baseDataIsolation);
        }
    }

    /** 兼容只准备用户授权的历史调用。 */
    public static function initUserAuthorizationToken(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        di(DataIsolationInitializerInterface::class)->initUserAuthorizationToken($baseDataIsolation, $lazy);
    }

    /** 按用户查询全局身份，保持原静态API。 */
    public static function getMagicId(string $userId): ?string
    {
        return di(MagicUserDomainService::class)->getByUserId($userId)?->getMagicId();
    }

    /** 兼容显式准备组织信息的历史调用。 */
    public static function initOrganizationInfo(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void
    {
        di(DataIsolationInitializerInterface::class)->initOrganizationInfo($baseDataIsolation, $lazy);
    }
}
