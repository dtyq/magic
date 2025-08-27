<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModeGroup\Assembler;

use App\Application\Mode\DTO\ModeGroupDTO;
use App\Interfaces\ModeGroup\DTO\Request\CreateModeGroupRequest;
use App\Interfaces\ModeGroup\DTO\Request\UpdateModeGroupRequest;

class ModeGroupApiAssembler
{
    /**
     * 创建请求转换为分组DTO.
     */
    public static function createRequestToModeGroupDTO(CreateModeGroupRequest $request): ModeGroupDTO
    {
        return new ModeGroupDTO($request->all());
    }

    /**
     * 更新请求转换为分组DTO.
     */
    public static function updateRequestToModeGroupDTO(UpdateModeGroupRequest $request): ModeGroupDTO
    {
        return new ModeGroupDTO($request->all());
    }
}
