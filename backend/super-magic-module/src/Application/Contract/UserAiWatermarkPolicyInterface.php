<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Contract;

use Qbhy\HyperfAuth\Authenticatable;

/**
 * 用户维度的 AI 明水印策略；开源默认实现恒为不叠水印.
 */
interface UserAiWatermarkPolicyInterface
{
    /**
     * 是否应在文件预览等场景对 AI 图应用明水印处理参数.
     */
    public function shouldApplyVisibleAiWatermark(Authenticatable $authorization): bool;

    /**
     * 当前用户是否可以去除 AI 明水印（用户偏好 ∧ 套餐等，依实现而定）.
     */
    public function canRemoveVisibleAiWatermark(Authenticatable $authorization): bool;
}
