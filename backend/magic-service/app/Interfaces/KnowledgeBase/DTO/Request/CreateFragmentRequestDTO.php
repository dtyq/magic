<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CreateFragmentRequestDTO extends AbstractRequestDTO
{
    public string $knowledgeBaseCode;

    public string $documentCode;

    public string $content;

    public array $metadata = [];

    public static function getHyperfValidationRules(): array
    {
        return [
            'knowledge_base_code' => 'required|string|max:255',
            'document_code' => 'required|string|max:255',
            'content' => 'required|string|max:65535',
            'metadata' => 'array',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'knowledge_base_code.required' => '知识库编码不能为空',
            'knowledge_base_code.max' => '知识库编码长度不能超过255个字符',
            'document_code.required' => '文档编码不能为空',
            'document_code.max' => '文档编码长度不能超过255个字符',
            'content.required' => '片段内容不能为空',
            'content.max' => '片段内容长度不能超过65535个字符',
        ];
    }

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): CreateFragmentRequestDTO
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getDocumentCode(): string
    {
        return $this->documentCode;
    }

    public function setDocumentCode(string $documentCode): CreateFragmentRequestDTO
    {
        $this->documentCode = $documentCode;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): CreateFragmentRequestDTO
    {
        $this->content = $content;
        return $this;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function setMetadata(array $metadata): CreateFragmentRequestDTO
    {
        $this->metadata = $metadata;
        return $this;
    }
}
