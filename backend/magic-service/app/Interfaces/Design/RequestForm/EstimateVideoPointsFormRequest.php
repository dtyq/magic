<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

class EstimateVideoPointsFormRequest extends GenerateVideoFormRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['video_id'], $rules['file_dir'], $rules['file_name'], $rules['prompt']);

        return $rules;
    }
}
