<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Infrastructure\Core\AbstractRequestDTO;

class UpdateDocumentRequestDTO extends AbstractRequestDTO
{
    public string $knowledgeBaseCode;

    public string $code;

    public string $name;

    public array $docMetadata = [];

    public ?FragmentConfig $fragmentConfig = null;

    public bool $enabled = true;

    public static function getHyperfValidationRules(): array
    {
        return [
            'code' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'fragment_config' => 'nullable|array',
            'doc_metadata' => 'array',
            'enabled' => 'boolean',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'code.required' => '文档编码不能为空',
            'code.max' => '文档编码长度不能超过64个字符',
            'name.required' => '文档名称不能为空',
            'name.max' => '文档名称长度不能超过255个字符',
            'enabled.boolean' => '启用状态必须为布尔值',
        ];
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getDocMetadata(): array
    {
        return $this->docMetadata;
    }

    public function setDocMetadata(array $docMetadata): self
    {
        $this->docMetadata = $docMetadata;
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

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): UpdateDocumentRequestDTO
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getFragmentConfig(): ?FragmentConfig
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(null|array|FragmentConfig $fragmentConfig): static
    {
        is_array($fragmentConfig) && $fragmentConfig = FragmentConfig::fromArray($fragmentConfig);
        $this->fragmentConfig = $fragmentConfig;
        return $this;
    }
}
