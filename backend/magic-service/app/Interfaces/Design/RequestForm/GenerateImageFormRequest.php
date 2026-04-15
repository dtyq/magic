<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\RequestForm;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class GenerateImageFormRequest extends FormRequest
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
            'prompt' => 'nullable|string|max:4096',
            'size' => 'nullable|string|max:50',
            'resolution' => 'nullable|string|max:50',
            'file_dir' => 'required|string|max:512',
            'file_name' => 'nullable|string|max:255',
            'reference_images' => 'nullable|array|max:20',
            'reference_images.*' => 'required|string',
            'reference_image_options' => 'nullable|array',
        ];
    }

    public function attributes(): array
    {
        return [
            'project_id' => trans('design.attributes.project_id'),
            'image_id' => trans('design.attributes.image_id'),
            'model_id' => trans('design.attributes.model_id'),
            'prompt' => trans('design.attributes.prompt'),
            'size' => trans('design.attributes.size'),
            'resolution' => trans('design.attributes.resolution'),
            'file_dir' => trans('design.attributes.file_dir'),
            'file_name' => trans('design.attributes.file_name'),
            'reference_images' => trans('design.attributes.reference_images'),
            'reference_images.*' => trans('design.attributes.reference_image'),
        ];
    }

    public function messages(): array
    {
        return [
            'reference_images.max' => trans('design.validation.reference_images_max'),
        ];
    }
}
