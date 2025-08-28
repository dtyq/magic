<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum SuperMagicAgentToolType: int
{
    // 1: 内置
    case BuiltIn = 1;

    // 2: 官方
    case Official = 2;

    // 3: 自定义
    case Custom = 3;
}
