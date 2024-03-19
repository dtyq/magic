<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Contract;

/**
 * 权限标签服务接口.
 * Domain层定义，用于Audit模块获取权限相关的标签信息.
 *
 * 设计说明：
 * 1. 此接口属于Audit模块，用于操作日志记录时获取权限标签
 * 2. 由Domain层定义接口，Application层实现，Infrastructure层使用
 * 3. 通过依赖倒置原则，避免Infrastructure层直接依赖Application层
 * 4. 接口名明确表示用途：获取权限标签（而非泛泛的权限服务）
 */
interface PermissionLabelServiceInterface
{
    /**
     * 获取资源标签（中文名称）.
     *
     * @param string $resourceCode 资源代码，如：platform.ai.model_management
     * @return string 资源标签，如：模型管理
     */
    public function getResourceLabel(string $resourceCode): string;

    /**
     * 获取资源标签路径（三级拼接）.
     *
     * @param string $resourceCode 资源代码，如：platform.ai.model_management
     * @return string 资源标签路径，如：平台管理后台-AI管理-模型管理
     */
    public function getResourceLabelPath(string $resourceCode): string;

    /**
     * 获取操作标签（中文名称）.
     *
     * @param string $operationCode 操作代码，如：query、edit
     * @return string 操作标签，如：查看、编辑
     */
    public function getOperationLabel(string $operationCode): string;

    /**
     * 获取按资源的操作标签（中文名称）.
     *
     * @param string $resourceCode 资源代码，如：platform.ai.model_management
     * @param string $operationCode 操作代码，如：query、edit
     * @return string 操作标签，如：查看、编辑
     */
    public function getOperationLabelByResource(string $resourceCode, string $operationCode): string;
}
