<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest;

use Hyperf\Validation\Request\FormRequest;

/**
 * Open API create message schedule form request.
 * Validates: task_name, message_content, time_config, topic_id, model_id, remark.
 */
class CreateOpenMessageScheduleFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'task_name' => 'required|string|max:255',
            'message_content' => 'required',
            'time_config' => 'required|array',
            'time_config.type' => [
                'required',
                'string',
                'in:no_repeat,daily_repeat,weekly_repeat,monthly_repeat',
            ],
            'time_config.day' => 'nullable|string',
            'time_config.time' => ['nullable', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'topic_id' => 'required',
            'model_id' => 'required|string',
            'remark' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'task_name.required' => 'Task name cannot be empty',
            'task_name.string' => 'Task name must be a string',
            'task_name.max' => 'Task name cannot exceed 255 characters',
            'message_content.required' => 'Message content cannot be empty',
            'time_config.required' => 'Time configuration cannot be empty',
            'time_config.array' => 'Time configuration must be an array',
            'time_config.type.required' => 'Time configuration type cannot be empty',
            'time_config.type.in' => 'Time configuration type must be one of: no_repeat, daily_repeat, weekly_repeat, monthly_repeat, annually_repeat, weekday_repeat, custom_repeat',
            'topic_id.required' => 'Topic ID is required',
            'model_id.required' => 'Model ID is required',
            'model_id.string' => 'Model ID must be a string',
        ];
    }
}
