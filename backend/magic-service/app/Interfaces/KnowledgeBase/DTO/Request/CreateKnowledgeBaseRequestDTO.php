<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\AbstractDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;

class CreateKnowledgeBaseRequestDTO extends AbstractRequestDTO
{
    public string $name;

    public string $description;

    public string $icon;

    public bool $enabled;

    public ?array $embeddingConfig = null;

    /** @var array<DocumentFileDTOInterface> */
    public array $documentFiles = [];

    public FragmentConfig $fragmentConfig;

    public RetrieveConfig $retrieveConfig;

    public string $businessId = '';

    public int $sourceType;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getFragmentConfig(): FragmentConfig
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(?array $fragmentConfig): self
    {
        $this->fragmentConfig = FragmentConfig::fromArray($fragmentConfig);
        return $this;
    }

    public function getEmbeddingConfig(): ?array
    {
        return $this->embeddingConfig;
    }

    public function setEmbeddingConfig(?array $embeddingConfig): self
    {
        $this->embeddingConfig = $embeddingConfig;
        return $this;
    }

    public function getRetrieveConfig(): RetrieveConfig
    {
        return $this->retrieveConfig ?? RetrieveConfig::createDefault();
    }

    public function setRetrieveConfig(?array $retrieveConfig): self
    {
        $retrieveConfig = RetrieveConfig::fromArray($retrieveConfig);
        $this->retrieveConfig = $retrieveConfig;
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): CreateKnowledgeBaseRequestDTO
    {
        $this->icon = $icon;
        return $this;
    }

    public function getDocumentFiles(): array
    {
        return $this->documentFiles;
    }

    public function setDocumentFiles(array $documentFiles): void
    {
        $this->documentFiles = array_map(fn ($file) => AbstractDocumentFileDTO::fromArray($file), $documentFiles);
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(string $businessId): void
    {
        $this->businessId = $businessId;
    }

    public function getSourceType(): int
    {
        return $this->sourceType;
    }

    public function setSourceType(int $sourceType): self
    {
        $this->sourceType = $sourceType;
        return $this;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'string|max:255',
            'source_type' => 'required|integer',
            'icon' => 'string|max:255',
            'enabled' => 'required|boolean',
            'embedding_config' => 'array',
            'retrieve_config' => 'array',
            'document_files' => 'required|array',
            'document_files.*.type' => 'integer|between:1,2',
            'document_files.*.name' => 'required|string',
            'document_files.*.key' => 'required_if:document_files.*.type,1|string',
            'document_files.*.third_file_id' => 'required_if:document_files.*.type,2|string',
            'document_files.*.platform_type' => 'required_if:document_files.*.type,2|string',
            // 分段设置
            'fragment_config' => 'array',
            'fragment_config.mode' => 'integer|in:1,2',
            'fragment_config.normal' => 'required_if:fragment_config.mode,1|array',
            'fragment_config.normal.text_preprocess_rule' => 'array',
            'fragment_config.normal.text_preprocess_rule.*' => 'integer|in:1,2',
            'fragment_config.normal.segment_rule' => 'required_if:fragment_config.mode,1|array',
            'fragment_config.normal.segment_rule.separator' => 'required_if:fragment_config.mode,1|string',
            'fragment_config.normal.segment_rule.chunk_size' => 'required_if:fragment_config.mode,1|integer|min:1',
            'fragment_config.normal.segment_rule.chunk_overlap' => 'required_if:fragment_config.mode,1|integer|min:0',
            'fragment_config.parent_child' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.chunk_size' => 'required_if:fragment_config.mode,2|integer|min:1',
            'fragment_config.parent_child.parent_mode' => 'required_if:fragment_config.mode,2|integer|in:1,2',
            'fragment_config.parent_child.child_segment_rule' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.child_segment_rule.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.child_segment_rule.chunk_size' => 'required_if:fragment_config.mode,2|integer|min:1',
            'fragment_config.parent_child.parent_segment_rule' => 'required_if:fragment_config.mode,2|array',
            'fragment_config.parent_child.parent_segment_rule.separator' => 'required_if:fragment_config.mode,2|string',
            'fragment_config.parent_child.parent_segment_rule.chunk_size' => 'required_if:fragment_config.mode,2|integer|min:1',
            'fragment_config.parent_child.text_preprocess_rule' => 'array',
            'fragment_config.parent_child.text_preprocess_rule.*' => 'integer|in:1,2',
            // todo 检索设置
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
