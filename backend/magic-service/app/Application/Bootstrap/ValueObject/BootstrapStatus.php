<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\ValueObject;

/**
 * Bootstrap 状态
 *
 * fresh:
 * 全新环境，尚未发现核心业务数据，允许执行 bootstrap 初始化。
 *
 * legacy:
 * 旧环境，已发现账号或用户等核心业务数据，但未走过当前 bootstrap 流程。
 * 这类环境为了避免误初始化，不允许再执行 bootstrap。
 *
 * initialized:
 * 已完成当前 bootstrap 初始化流程，不允许重复执行。
 */
enum BootstrapStatus: string
{
    /** 全新环境，可执行 bootstrap */
    case Fresh = 'fresh';

    /** 老环境，已有业务数据，不可执行 bootstrap */
    case Legacy = 'legacy';

    /** 已完成 bootstrap，不可重复执行 */
    case Initialized = 'initialized';

    /**
     * 是否还需要初始化.
     */
    public function needInitial(): bool
    {
        return $this === self::Fresh;
    }

    /**
     * 是否允许执行 bootstrap.
     */
    public function allowExecute(): bool
    {
        return $this === self::Fresh;
    }
}
