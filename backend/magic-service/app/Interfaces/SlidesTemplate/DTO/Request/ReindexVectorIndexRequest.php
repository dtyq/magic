<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class ReindexVectorIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'force_re_embedding' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'force_re_embedding.boolean' => __('slides_template.force_re_embedding_boolean'),
        ];
    }

    /**
     * 是否强制重新生成向量。
     *
     * 开启后，当向量集合维度与模型实际输出维度不一致时会删除集合并按实际维度重建，随后全量重灌数据；
     * 关闭时遇到维度不一致直接抛错，不会改动集合。
     */
    public function getForceReEmbedding(): bool
    {
        return filter_var($this->input('force_re_embedding', false), FILTER_VALIDATE_BOOL);
    }
}
