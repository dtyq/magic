<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;
use Hyperf\Contract\Arrayable;

class FragmentPreviewRequestDTO extends AbstractRequestDTO
{
    public string $documentCode = '';

    public array $documentFile = [];

    public array $fragmentConfig = [];

    public array $strategyConfig = [];

    public static function getHyperfValidationRules(): array
    {
        return [];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [];
    }

    public function getDocumentFile(): array
    {
        return $this->documentFile;
    }

    public function getDocumentCode(): string
    {
        return $this->documentCode;
    }

    public function setDocumentCode(string $documentCode): void
    {
        $this->documentCode = $documentCode;
    }

    public function setDocumentFile(array|DocumentFileDTOInterface $documentFile): void
    {
        if ($documentFile instanceof Arrayable) {
            $documentFile = $documentFile->toArray();
        }
        $this->documentFile = $documentFile;
    }

    public function getFragmentConfig(): array
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(array $fragmentConfig): void
    {
        $this->fragmentConfig = $fragmentConfig;
    }

    public function getStrategyConfig(): array
    {
        return $this->strategyConfig;
    }

    public function setStrategyConfig(array $strategyConfig): void
    {
        $this->strategyConfig = $strategyConfig;
    }
}
