<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class GetFragmentListRequestDTO extends AbstractRequestDTO
{
    public string $knowledgeBaseCode;

    public string $documentCode;

    public int $page = 1;

    public int $pageSize = 100;

    public static function getHyperfValidationRules(): array
    {
        return [
            'knowledge_base_code' => 'required|string|max:255',
            'document_code' => 'required|string|max:255',
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'knowledge_base_code.required' => '知识库编码不能为空',
            'knowledge_base_code.max' => '知识库编码长度不能超过255个字符',
            'document_code.required' => '文档编码不能为空',
            'document_code.max' => '文档编码长度不能超过255个字符',
        ];
    }

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): GetFragmentListRequestDTO
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getDocumentCode(): string
    {
        return $this->documentCode;
    }

    public function setDocumentCode(string $documentCode): GetFragmentListRequestDTO
    {
        $this->documentCode = $documentCode;
        return $this;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): GetFragmentListRequestDTO
    {
        $this->page = $page;
        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): GetFragmentListRequestDTO
    {
        $this->pageSize = $pageSize;
        return $this;
    }
}
