<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

/**
 * 沙箱 / 部署环境标识（与 DEPLOYMENT_ID、super-magic.sandbox.deployment_id 对齐）。
 */
class DeploymentIdConstant
{
    /** 测试生产预发布环境 */
    public const PRODUCTION_PREPROD = 'a2503897';

    /** 测试 */
    public const TEST = 'a2503827';

    public static function isDomestic(): bool
    {
        $deploymentId = config('super-magic.sandbox.deployment_id', '');
        return $deploymentId === self::TEST || $deploymentId === self::PRODUCTION_PREPROD;
    }
}
