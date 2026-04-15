<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use Hyperf\Validation\Request\FormRequest;

class QueryVideoGenerationResultFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => 'required|integer|min:1',
            'video_id' => 'required|string|max:80',
        ];
    }
}
