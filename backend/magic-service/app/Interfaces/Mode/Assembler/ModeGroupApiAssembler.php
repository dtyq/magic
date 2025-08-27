<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Assembler;

use App\Application\Mode\DTO\AdminModeGroupDTO;
use App\Interfaces\Mode\DTO\Request\CreateModeGroupRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeGroupRequest;

class ModeGroupApiAssembler
{
    /**
     * 创建请求转换为分组DTO.
     */
    public static function createRequestToModeGroupDTO(CreateModeGroupRequest $request): AdminModeGroupDTO
    {
        return new AdminModeGroupDTO($request->all());
    }

    /**
     * 更新请求转换为分组DTO.
     */
    public static function updateRequestToModeGroupDTO(UpdateModeGroupRequest $request): AdminModeGroupDTO
    {
        return new AdminModeGroupDTO($request->all());
    }
}
