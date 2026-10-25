<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class PublishSlidesTemplateFromProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => 'required|integer|min:1',
            'directory_id' => 'required|integer|min:1',
            'code' => ['nullable', 'string', 'max:64', 'regex:/^(PPT|SLIDE)-[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_id.required' => __('slides_template.project_id_required'),
            'project_id.integer' => __('slides_template.project_id_integer'),
            'project_id.min' => __('slides_template.project_id_min'),
            'directory_id.required' => __('slides_template.directory_id_required'),
            'directory_id.integer' => __('slides_template.directory_id_integer'),
            'directory_id.min' => __('slides_template.directory_id_min'),
            'code.string' => __('slides_template.code_string'),
            'code.max' => __('slides_template.code_max'),
            'code.regex' => __('slides_template.code_regex'),
        ];
    }

    public function getProjectId(): int
    {
        return (int) $this->input('project_id');
    }

    public function getDirectoryId(): int
    {
        return (int) $this->input('directory_id');
    }

    public function getCode(): ?string
    {
        $code = trim((string) $this->input('code', ''));
        return $code === '' ? null : $code;
    }
}
