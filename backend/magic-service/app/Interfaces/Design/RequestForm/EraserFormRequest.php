<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class EraserFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => 'required|integer|min:1',
            'image_id' => 'required|string|max:80',
            'model_id' => 'required|string|max:80',
            'file_dir' => 'required|string|max:512',
            'file_path' => 'required|string|max:512',
            'mark_path' => 'required|string|max:512',
        ];
    }

    public function attributes(): array
    {
        return [
            'project_id' => trans('design.attributes.project_id'),
            'image_id' => trans('design.attributes.image_id'),
            'model_id' => trans('design.attributes.model_id'),
            'file_dir' => trans('design.attributes.file_dir'),
            'file_path' => trans('design.attributes.file_path'),
            'mark_path' => trans('design.attributes.mark_path'),
        ];
    }
}
