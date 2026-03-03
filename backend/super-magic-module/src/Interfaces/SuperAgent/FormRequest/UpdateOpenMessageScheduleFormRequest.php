<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest;

use Hyperf\Validation\Request\FormRequest;

class UpdateOpenMessageScheduleFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'task_name' => 'nullable|string|max:255',
            'message_content' => 'nullable',
            'time_config' => 'nullable|array',
            'time_config.type' => [
                'nullable',
                'string',
                'in:no_repeat,daily_repeat,weekly_repeat,monthly_repeat',
            ],
            'time_config.day' => 'nullable|string',
            'time_config.time' => ['nullable', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'model_id' => 'nullable|string',
            'enabled' => 'nullable|integer|in:0,1',
        ];
    }

    public function messages(): array
    {
        return [
            'task_name.string' => 'Task name must be a string',
            'task_name.max' => 'Task name cannot exceed 255 characters',
            'time_config.array' => 'Time configuration must be an array',
            'time_config.type.in' => 'Time configuration type must be one of: no_repeat, daily_repeat, weekly_repeat, monthly_repeat',
            'model_id.string' => 'Model ID must be a string',
            'enabled.integer' => 'Enabled must be an integer',
            'enabled.in' => 'Enabled must be 0 or 1',
        ];
    }
}
