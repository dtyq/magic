<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Assembler;

use App\Application\Mode\DTO\ModeDTO;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;

class ModeApiAssembler
{
    /**
     * 创建请求转换为详情DTO.
     */
    public static function createRequestToModeDTO(CreateModeRequest $request): ModeDTO
    {
        return new ModeDTO($request->all());
    }

    /**
     * 更新请求转换为详情DTO.
     */
    public static function updateRequestToModeDTO(UpdateModeRequest $request): ModeDTO
    {
        return new ModeDTO($request->all());
    }
}
