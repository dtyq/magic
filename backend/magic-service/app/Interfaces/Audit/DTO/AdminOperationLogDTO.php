<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 管理员操作日志 DTO.
 */
class AdminOperationLogDTO extends AbstractDTO
{
    // 产品图展示字段
    public string $id = ''; // 日志ID，必须是字符串（雪花ID）

    public string $userName = ''; // 操作用户名

    public string $userId = ''; // 操作用户ID

    public string $ip = ''; // IP地址

    public string $requestUrl = ''; // 请求URL（包含方法和完整路径）

    public string $requestBody = ''; // 请求体内容（JSON格式）

    public string $operationTime = ''; // 操作时间，格式: 2026-01-27 11:27:51

    public string $operationLabel = ''; // 操作类型（如：查看、编辑）

    public string $resourceLabel = ''; // 资源名称（如：模型管理）

    public string $operationDescription = ''; // 操作描述

    // 技术字段（详情接口返回，用于调试）
    public string $resourceCode = ''; // 资源代码

    public string $operationCode = ''; // 操作代码
}
