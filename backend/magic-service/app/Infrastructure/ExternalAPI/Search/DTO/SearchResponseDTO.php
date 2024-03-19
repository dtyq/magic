<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Unified search response container.
 */
class SearchResponseDTO extends AbstractDTO
{
    protected ?WebPagesDTO $webPages = null;

    protected ?array $rawResponse = null;

    protected ?string $warning = null;

    protected ?array $metadata = null;

    public function getWebPages(): ?WebPagesDTO
    {
        return $this->webPages;
    }

    public function setWebPages(?WebPagesDTO $webPages): void
    {
        $this->webPages = $webPages;
    }

    public function getRawResponse(): ?array
    {
        return $this->rawResponse;
    }

    public function setRawResponse(?array $rawResponse): void
    {
        $this->rawResponse = $rawResponse;
    }

    public function getWarning(): ?string
    {
        return $this->warning;
    }

    public function setWarning(?string $warning): void
    {
        $this->warning = $warning;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $metadata): void
    {
        $this->metadata = $metadata;
    }

    /**
     * Convert DTO to array format for backward compatibility.
     */
    public function toArray(): array
    {
        $result = [];

        if ($this->webPages !== null) {
            $result['web_pages'] = [
                'total_estimated_matches' => $this->webPages->getTotalEstimatedMatches(),
                'value' => array_map(function (SearchResultItemDTO $item) {
                    $itemArray = [
                        'id' => $item->getId(),
                        'name' => $item->getName(),
                        'url' => $item->getUrl(),
                        'snippet' => $item->getSnippet(),
                        'display_url' => $item->getDisplayUrl(),
                        'dateLast_crawled' => $item->getDateLastCrawled(),
                    ];
                    // Add score only if it's set
                    if ($item->getScore() !== null) {
                        $itemArray['score'] = $item->getScore();
                    }
                    return $itemArray;
                }, $this->webPages->getValue()),
            ];
        }

        if ($this->rawResponse !== null) {
            $result['raw_response'] = $this->rawResponse;
        }

        if ($this->warning !== null) {
            $result['warning'] = $this->warning;
        }

        if ($this->metadata !== null) {
            $result['metadata'] = $this->metadata;
        }

        return $result;
    }
}
