<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Assembler;

use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;

class ModeApiAssembler
{
    /**
     * 创建请求转换为详情DTO.
     */
    public static function createRequestToModeDTO(CreateModeRequest $request): AdminModeDTO
    {
        return new AdminModeDTO($request->all());
    }

    /**
     * 更新请求转换为详情DTO.
     */
    public static function updateRequestToModeDTO(UpdateModeRequest $request): AdminModeDTO
    {
        return new AdminModeDTO($request->all());
    }
}
