<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

/** 隔离上下文能力的应用初始化端口，核心对象不依赖具体业务实现。 */
interface DataIsolationInitializerInterface
{
    /** 保留当前身份并准备环境及延迟能力。 */
    public function initialize(BaseDataIsolation $context, int $envId = 0, bool $force = false): void;

    /** 兼容旧授权准备入口，不执行完整环境初始化。 */
    public function initUserAuthorizationToken(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void;

    /** 兼容旧组织信息准备入口，不自动开启额外能力。 */
    public function initOrganizationInfo(BaseDataIsolation $baseDataIsolation, bool $lazy = true): void;
}
