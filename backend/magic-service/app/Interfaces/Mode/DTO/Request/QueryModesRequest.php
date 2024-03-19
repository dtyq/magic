<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class QueryModesRequest extends FormRequest
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
            'status' => 'nullable|string|in:true,false,1,0',
            'identifier' => 'nullable|string|max:50',
            'keyword' => 'nullable|string|max:100',
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => __('mode.page_integer'),
            'page.min' => __('mode.page_min'),
            'page_size.integer' => __('mode.page_size_integer'),
            'page_size.min' => __('mode.page_size_min'),
            'page_size.max' => __('mode.page_size_max'),
            'status.in' => __('mode.status_in'),
            'identifier.max' => __('mode.identifier_max'),
            'keyword.max' => __('mode.keyword_max'),
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

    public function getStatus(): ?string
    {
        return $this->input('status');
    }

    public function getIdentifier(): ?string
    {
        $identifier = $this->input('identifier');
        return $identifier !== null && $identifier !== '' ? $identifier : null;
    }

    public function getKeyword(): ?string
    {
        $keyword = $this->input('keyword');
        return $keyword !== null && $keyword !== '' ? $keyword : null;
    }
}
