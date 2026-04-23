<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

class EstimateVideoPointsFormRequest extends GenerateVideoFormRequest
{
    /**
     * 预估接口复用生成视频参数校验，但不要求任务 ID 和输出目录字段。
     */
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['video_id'], $rules['file_dir'], $rules['file_name']);

        return $rules;
    }
}
