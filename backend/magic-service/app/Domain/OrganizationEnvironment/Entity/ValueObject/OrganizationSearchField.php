<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\ValueObject;

/**
 * 组织搜索字段。
 */
enum OrganizationSearchField: string
{
    /** 组织编码，精确匹配。 */
    case OrganizationCode = 'organization_code';

    /** 组织名称，模糊匹配。 */
    case OrganizationName = 'organization_name';
}
