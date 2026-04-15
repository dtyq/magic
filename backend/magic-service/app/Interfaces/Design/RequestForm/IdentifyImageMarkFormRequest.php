<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use App\Domain\Design\Entity\ValueObject\ImageMarkIdentifyType;
use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class IdentifyImageMarkFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $validTypes = implode(',', ImageMarkIdentifyType::values());

        $mark = $this->input('mark');
        $area = $this->input('area');

        return [
            'project_id' => 'required|string|min:1',
            'file_path' => 'required|string|max:512',
            'type' => "nullable|integer|in:{$validTypes}",
            'number' => 'nullable|integer|min:1',
            'mark' => ! empty($mark) ? 'array|size:2' : 'nullable|array',
            'mark.*' => 'numeric|min:0|max:1',
            'area' => ! empty($area) ? 'array|size:4' : 'nullable|array',
            'area.*' => 'numeric|min:0',
        ];
    }

    public function attributes(): array
    {
        return [
            'project_id' => trans('design.attributes.project_id'),
            'file_path' => trans('design.attributes.file_path'),
            'type' => trans('design.attributes.type'),
            'number' => trans('design.attributes.number'),
            'mark' => trans('design.attributes.mark'),
            'mark.*' => trans('design.attributes.mark_coordinate'),
            'area' => trans('design.attributes.area'),
            'area.*' => trans('design.attributes.area_coordinate'),
        ];
    }

    public function messages(): array
    {
        return [
            'type.in' => trans('design.validation.type_invalid'),
            'mark.size' => trans('design.validation.mark_size'),
            'mark.*.min' => trans('design.validation.mark_coordinate_range'),
            'mark.*.max' => trans('design.validation.mark_coordinate_range'),
            'area.size' => trans('design.validation.area_size'),
            'area.*.min' => trans('design.validation.area_coordinate_range'),
        ];
    }
}
