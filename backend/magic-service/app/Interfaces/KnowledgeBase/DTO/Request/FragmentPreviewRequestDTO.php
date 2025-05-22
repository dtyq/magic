<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\AbstractDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;

class FragmentPreviewRequestDTO extends AbstractRequestDTO
{
    public DocumentFileDTOInterface $documentFile;

    public FragmentConfig $fragmentConfig;

    public static function getHyperfValidationRules(): array
    {
        return [
            'document_file' => 'required|array',
            'document_file.type' => 'integer|between:1,2',
            'document_file.name' => 'required|string',
            'document_file.key' => 'required_if:document_file.type,1|string',
            'document_file.third_file_id' => 'required_if:document_file.type,2|string',
            'document_file.platform_type' => 'required_if:document_file.type,2|string',
            'fragment_config' => 'required|array',
            'fragment_config.mode' => 'required|integer|in:1,2',
            'fragment_config.normal' => 'required_if:fragment_config.mode,1|array',
            'fragment_config.normal.text_preprocess_rule' => 'array',
            'fragment_config.normal.text_preprocess_rule.*' => 'required|integer|in:1,2',
            'fragment_config.normal.segment_rule' => 'required_if:fragment_config.mode,1|array',
            'fragment_config.normal.segment_rule.separator' => 'required_if:fragment_config.mode,1|string',
            'fragment_config.normal.segment_rule.chunk_size' => 'required_if:fragment_config.mode,1|integer|min:1',
            'fragment_config.normal.segment_rule.chunk_overlap' => 'required_if:fragment_config.mode,1|integer|min:0',
            'fragment_config.parent_child' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.chunk_size' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.parent_mode' => 'required_if:fragment_config.mode,2|integer|in:1,2',
            'fragment_config.parent_child.child_segment_rule' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.child_segment_rule.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.child_segment_rule.chunk_size' => 'required_if:fragment_config.mode,2|integer|min:1',
            'fragment_config.parent_child.parent_segment_rule' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.parent_segment_rule.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.parent_segment_rule.chunk_size' => 'required_if:fragment_config.mode,2|integer|min:1',
            'fragment_config.parent_child.text_preprocess_rule' => 'array',
            'fragment_config.parent_child.text_preprocess_rule.*' => 'required|integer|in:1,2',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'document_file.required' => '文档文件不能为空',
            'document_file.name.required' => '文档名称不能为空',
            'document_file.name.max' => '文档名称长度不能超过255个字符',
            'document_file.key.required' => '文档键不能为空',
            'document_file.key.max' => '文档键长度不能超过255个字符',
            'fragment_config.required' => '片段配置不能为空',
            'fragment_config.mode.required' => '分段模式不能为空',
            'fragment_config.mode.integer' => '分段模式必须是整数',
            'fragment_config.mode.in' => '分段模式必须是 1(通用模式) 或 2(父子分段)',
            'fragment_config.normal.required_if' => '通用模式配置不能为空',
            'fragment_config.normal.text_preprocess_rule.required_if' => '文本预处理规则不能为空',
            'fragment_config.normal.text_preprocess_rule.*.required' => '预处理规则项不能为空',
            'fragment_config.normal.text_preprocess_rule.*.integer' => '预处理规则必须是整数',
            'fragment_config.normal.text_preprocess_rule.*.in' => '预处理规则必须是 1(替换空格等) 或 2(删除URL和邮箱)',
            'fragment_config.normal.segment_rule.required_if' => '分段规则不能为空',
            'fragment_config.normal.segment_rule.separator.required_if' => '分段标识符不能为空',
            'fragment_config.normal.segment_rule.chunk_size.required_if' => '最大分段长度不能为空',
            'fragment_config.normal.segment_rule.chunk_size.min' => '最大分段长度必须大于0',
            'fragment_config.normal.segment_rule.chunk_overlap.required_if' => '分段重叠长度不能为空',
            'fragment_config.normal.segment_rule.chunk_overlap.min' => '分段重叠长度必须大于等于0',
            'fragment_config.parent_child.required_if' => '父子分段配置不能为空',
            'fragment_config.parent_child.separator.required_if' => '分段标识符不能为空',
            'fragment_config.parent_child.chunk_size.required_if' => '文本不能为空',
            'fragment_config.parent_child.parent_mode.required_if' => '父块模式不能为空',
            'fragment_config.parent_child.parent_mode.in' => '父块模式必须是 1(段落) 或 2(权威)',
            'fragment_config.parent_child.child_segment_rule.required_if' => '子块分段规则不能为空',
            'fragment_config.parent_child.child_segment_rule.separator.required_if' => '子块分段标识符不能为空',
            'fragment_config.parent_child.child_segment_rule.chunk_size.required_if' => '子块最大分段长度不能为空',
            'fragment_config.parent_child.child_segment_rule.chunk_size.min' => '子块最大分段长度必须大于0',
            'fragment_config.parent_child.parent_segment_rule.required_if' => '父块分段规则不能为空',
            'fragment_config.parent_child.parent_segment_rule.separator.required_if' => '父块分段标识符不能为空',
            'fragment_config.parent_child.parent_segment_rule.chunk_size.required_if' => '父块最大分段长度不能为空',
            'fragment_config.parent_child.parent_segment_rule.chunk_size.min' => '父块最大分段长度必须大于0',
            'fragment_config.parent_child.text_preprocess_rule.required_if' => '文本预处理规则不能为空',
            'fragment_config.parent_child.text_preprocess_rule.*.required' => '预处理规则项不能为空',
            'fragment_config.parent_child.text_preprocess_rule.*.integer' => '预处理规则必须是整数',
            'fragment_config.parent_child.text_preprocess_rule.*.in' => '预处理规则必须是 1(替换空格等) 或 2(删除URL和邮箱)',
        ];
    }

    public function getDocumentFile(): DocumentFileDTOInterface
    {
        return $this->documentFile;
    }

    public function setDocumentFile(array|DocumentFileDTOInterface $documentFile): void
    {
        is_array($documentFile) && $documentFile = AbstractDocumentFileDTO::fromArray($documentFile);
        $this->documentFile = $documentFile;
    }

    public function getFragmentConfig(): FragmentConfig
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(array $fragmentConfig): void
    {
        $this->fragmentConfig = FragmentConfig::fromArray($fragmentConfig);
    }
}
