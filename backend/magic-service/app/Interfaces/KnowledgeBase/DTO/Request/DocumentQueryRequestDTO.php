<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class DocumentQueryRequestDTO extends AbstractRequestDTO
{
    public ?string $knowledgeBaseCode = null;

    public ?string $name = null;

    public ?int $docType = null;

    public ?bool $enabled = null;

    public ?int $syncStatus = null;

    public int $page = 1;

    public int $pageSize = 20;

    public static function getHyperfValidationRules(): array
    {
        return [
            'knowledge_base_code' => 'string|required',
            'name' => 'string|nullable',
            'doc_type' => 'integer|nullable',
            'enabled' => 'boolean|nullable',
            'sync_status' => 'integer|nullable',
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'page.min' => '页码必须大于等于1',
            'page_size.min' => '每页数量必须大于等于1',
            'page_size.max' => '每页数量不能超过100',
        ];
    }

    public function getKnowledgeBaseCode(): ?string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(?string $knowledgeBaseCode): self
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getDocType(): ?int
    {
        return $this->docType;
    }

    public function setDocType(?int $docType): self
    {
        $this->docType = $docType;
        return $this;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getSyncStatus(): ?int
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(?int $syncStatus): self
    {
        $this->syncStatus = $syncStatus;
        return $this;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }
}
