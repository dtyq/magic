<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class SaveSlidesTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['nullable', 'string', 'max:64', 'regex:/^(PPT|SLIDE)-[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/'],
            'category_code' => 'nullable|string|max:64',
            'label' => 'required|array',
            'label.zh_CN' => 'required|string|max:100',
            'label.en_US' => 'required|string|max:100',
            'description' => 'required|array',
            'description.zh_CN' => 'required|string|max:1000',
            'description.en_US' => 'required|string|max:1000',
            'thumbnail_file_key' => 'required|string|max:512',
            'collage_file_key' => 'nullable|string|max:512',
            'preview_image_file_keys' => 'nullable|array',
            'preview_image_file_keys.*' => 'string|max:512',
            'template_file_key' => 'required|string|max:512',
            'preview_url' => 'nullable|url|max:1024',
            'status' => 'nullable|integer|in:0,1',
            'sort' => 'nullable|integer',
            'tag_codes' => 'nullable|array',
            'tag_codes.*' => 'string|max:64|regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
        ];
    }

    public function messages(): array
    {
        return [
            'code.string' => __('slides_template.code_string'),
            'code.max' => __('slides_template.code_max'),
            'code.regex' => __('slides_template.code_regex'),
            'category_code.string' => __('slides_template.category_code_string'),
            'category_code.max' => __('slides_template.category_code_max'),
            'label.required' => __('slides_template.label_required'),
            'label.array' => __('slides_template.label_array'),
            'label.zh_CN.required' => __('slides_template.label_zh_cn_required'),
            'label.zh_CN.max' => __('slides_template.label_zh_cn_max'),
            'label.en_US.required' => __('slides_template.label_en_us_required'),
            'label.en_US.max' => __('slides_template.label_en_us_max'),
            'description.required' => __('slides_template.description_required'),
            'description.array' => __('slides_template.description_array'),
            'description.zh_CN.required' => __('slides_template.description_zh_cn_required'),
            'description.zh_CN.max' => __('slides_template.description_zh_cn_max'),
            'description.en_US.required' => __('slides_template.description_en_us_required'),
            'description.en_US.max' => __('slides_template.description_en_us_max'),
            'thumbnail_file_key.required' => __('slides_template.thumbnail_file_key_required'),
            'thumbnail_file_key.string' => __('slides_template.file_key_string'),
            'thumbnail_file_key.max' => __('slides_template.file_key_max'),
            'collage_file_key.string' => __('slides_template.file_key_string'),
            'collage_file_key.max' => __('slides_template.file_key_max'),
            'preview_image_file_keys.array' => __('slides_template.preview_image_file_keys_array'),
            'preview_image_file_keys.*.string' => __('slides_template.file_key_string'),
            'preview_image_file_keys.*.max' => __('slides_template.file_key_max'),
            'template_file_key.required' => __('slides_template.template_file_key_required'),
            'template_file_key.string' => __('slides_template.file_key_string'),
            'template_file_key.max' => __('slides_template.file_key_max'),
            'preview_url.url' => __('slides_template.preview_url_url'),
            'preview_url.max' => __('slides_template.preview_url_max'),
            'status.in' => __('slides_template.status_in'),
            'sort.integer' => __('slides_template.sort_integer'),
            'tag_codes.array' => __('slides_template.tag_codes_array'),
            'tag_codes.*.string' => __('slides_template.tag_codes_string'),
            'tag_codes.*.max' => __('slides_template.tag_code_max'),
            'tag_codes.*.regex' => __('slides_template.tag_code_regex'),
        ];
    }

    public function getCode(): ?string
    {
        $code = trim((string) $this->input('code', ''));
        return $code === '' ? null : $code;
    }

    public function getLabel(): array
    {
        return (array) $this->input('label', []);
    }

    public function getCategoryCode(): ?string
    {
        $categoryCode = trim((string) $this->input('category_code', ''));
        return $categoryCode === '' ? null : $categoryCode;
    }

    public function getDescription(): array
    {
        return (array) $this->input('description', []);
    }

    public function getThumbnailFileKey(): string
    {
        return (string) $this->input('thumbnail_file_key', '');
    }

    public function getCollageFileKey(): ?string
    {
        $fileKey = trim((string) $this->input('collage_file_key', ''));
        return $fileKey === '' ? null : $fileKey;
    }

    public function getPreviewImageFileKeys(): array
    {
        $fileKeys = $this->input('preview_image_file_keys', []);
        if (! is_array($fileKeys)) {
            return [];
        }

        $result = [];
        foreach ($fileKeys as $fileKey) {
            if (! is_string($fileKey)) {
                continue;
            }
            $fileKey = trim($fileKey);
            if ($fileKey !== '') {
                $result[] = $fileKey;
            }
        }
        return $result;
    }

    public function getTemplateFileKey(): string
    {
        return (string) $this->input('template_file_key', '');
    }

    public function getPreviewUrl(): ?string
    {
        $previewUrl = trim((string) $this->input('preview_url', ''));
        return $previewUrl === '' ? null : $previewUrl;
    }

    public function getStatus(): int
    {
        return (int) $this->input('status', 1);
    }

    public function hasStatus(): bool
    {
        return array_key_exists('status', $this->all());
    }

    public function getSort(): int
    {
        return (int) $this->input('sort', 0);
    }

    public function getTagCodes(): array
    {
        $tagCodes = $this->input('tag_codes', []);
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

    public function hasTagCodes(): bool
    {
        return $this->has('tag_codes');
    }
}
