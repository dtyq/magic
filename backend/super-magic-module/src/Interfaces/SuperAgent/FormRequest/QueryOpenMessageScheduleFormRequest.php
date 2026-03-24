<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest;

use Hyperf\Validation\Request\FormRequest;

class QueryOpenMessageScheduleFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'project_id' => 'required|string',
            'task_name' => 'nullable|string',
            'enabled' => 'nullable|integer|in:0,1',
            'completed' => 'nullable|integer|in:0,1',
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be at least 1',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be at least 1',
            'page_size.max' => 'Page size cannot exceed 100',
            'project_id.required' => 'Project id is required',
            'enabled.in' => 'Enabled must be 0 or 1',
            'completed.in' => 'Completed must be 0 or 1',
        ];
    }
}
