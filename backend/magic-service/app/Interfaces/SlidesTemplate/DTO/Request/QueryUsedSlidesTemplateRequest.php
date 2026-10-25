<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

class QueryUsedSlidesTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:200',
        ];
    }

    public function getPage(): int
    {
        return (int) $this->input('page', 1);
    }

    public function getPageSize(): int
    {
        return (int) $this->input('page_size', 20);
    }
}
