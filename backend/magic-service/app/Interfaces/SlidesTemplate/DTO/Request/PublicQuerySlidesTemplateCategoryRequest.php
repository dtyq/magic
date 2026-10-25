<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class PublicQuerySlidesTemplateCategoryRequest extends FormRequest
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
            'keyword' => 'nullable|string|max:100',
            'token' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => __('slides_template.page_integer'),
            'page.min' => __('slides_template.page_min'),
            'page_size.integer' => __('slides_template.page_size_integer'),
            'page_size.min' => __('slides_template.page_size_min'),
            'page_size.max' => __('slides_template.page_size_max'),
            'keyword.max' => __('slides_template.keyword_max'),
        ];
    }

    public function getPage(): int
    {
        return (int) $this->input('page', 1);
    }

    public function getToken(): string
    {
        return trim((string) $this->input('token', ''));
    }

    public function getPageSize(): int
    {
        return (int) $this->input('page_size', 200);
    }

    public function getKeyword(): ?string
    {
        $keyword = trim((string) $this->input('keyword', ''));
        return $keyword === '' ? null : $keyword;
    }
}
