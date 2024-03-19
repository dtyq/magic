<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Query;

/**
 * 知识库文档查询.
 */
class KnowledgeBaseDocumentQuery extends Query
{
    protected string $knowledgeBaseCode;

    protected ?string $code = null;

    protected ?string $name = null;

    protected ?bool $enabled = null;

    protected ?int $docType = null;

    protected ?int $syncStatus = null;

    protected ?string $createdUid = null;

    protected ?string $updatedUid = null;

    /**
     * 知识库文档代码数组，用于批量查询.
     *
     * @var null|string[]
     */
    protected ?array $codes = null;

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): self
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(?string $code): self
    {
        $this->code = $code;
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

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): self
    {
        $this->enabled = $enabled;
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

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    /**
     * @return null|string[]
     */
    public function getCodes(): ?array
    {
        return $this->codes;
    }

    /**
     * @param null|string[] $codes
     */
    public function setCodes(?array $codes): self
    {
        $this->codes = $codes;
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
}
