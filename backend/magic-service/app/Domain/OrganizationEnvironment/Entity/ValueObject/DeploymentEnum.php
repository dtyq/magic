<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\ValueObject;

enum DeploymentEnum: string
{
    // 国内 saas
    case SaaS = 'saas';

    // 国际 saas
    case InternationalSaaS = 'international_saas';

    // 开源
    case OpenSource = 'open_source';

    // 未知
    case Unknown = 'unknown';
}
