<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * 服务商配置搜索字段。
 */
enum ProviderConfigSearchField: string
{
    /** 服务商配置 ID，精确匹配。 */
    case ConfigId = 'service_provider_config_id';

    /** 服务商主体名称，模糊匹配。 */
    case ProviderName = 'provider_name';

    /** 服务商配置别名，模糊匹配。 */
    case ProviderAlias = 'provider_alias';
}
