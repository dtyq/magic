<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class PublicQuerySlidesTemplateTagRequest extends FormRequest
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
            'category_code' => 'nullable|string|max:64',
            'tag_codes' => 'nullable',
            'tag_match' => 'nullable|string|in:any,all',
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
            'category_code.max' => __('slides_template.category_code_max'),
            'tag_match.in' => __('slides_template.tag_match_in'),
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
        return (int) $this->input('page_size', 20);
    }

    public function getKeyword(): ?string
    {
        $keyword = trim((string) $this->input('keyword', ''));
        return $keyword === '' ? null : $keyword;
    }

    public function getCategoryCode(): ?string
    {
        $categoryCode = trim((string) $this->input('category_code', ''));
        return $categoryCode === '' ? null : $categoryCode;
    }

    public function getTagCodes(): array
    {
        return $this->normalizeTagCodes($this->input('tag_codes', []));
    }

    public function getTagMatch(): string
    {
        $tagMatch = trim((string) $this->input('tag_match', 'any'));
        return in_array($tagMatch, ['any', 'all'], true) ? $tagMatch : 'any';
    }

    private function normalizeTagCodes(mixed $tagCodes): array
    {
        if (is_string($tagCodes)) {
            $tagCodes = explode(',', $tagCodes);
        }
        if (! is_array($tagCodes)) {
            return [];
        }

        $result = [];
        foreach ($tagCodes as $tagCode) {
            if (! is_string($tagCode)) {
                continue;
            }
            $tagCode = trim($tagCode);
            if ($tagCode !== '') {
                $result[$tagCode] = $tagCode;
            }
        }
        return array_values($result);
    }
}
