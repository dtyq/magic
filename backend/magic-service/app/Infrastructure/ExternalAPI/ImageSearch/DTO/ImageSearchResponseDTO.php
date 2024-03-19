<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Unified image search response container.
 */
class ImageSearchResponseDTO extends AbstractDTO
{
    protected ?ImagesDTO $images = null;

    protected ?array $rawResponse = null;

    protected ?string $warning = null;

    protected ?array $metadata = null;

    public function getImages(): ?ImagesDTO
    {
        return $this->images;
    }

    public function setImages(?ImagesDTO $images): void
    {
        $this->images = $images;
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
     * Convert DTO to array format.
     */
    public function toArray(): array
    {
        $result = [];

        if ($this->images !== null) {
            $result['images'] = [
                'total_estimated_matches' => $this->images->getTotalEstimatedMatches(),
                'value' => array_map(function (ImageResultItemDTO $item) {
                    $itemArray = [
                        'content_url' => $item->getContentUrl(),
                        'name' => $item->getName(),
                        'width' => $item->getWidth(),
                        'height' => $item->getHeight(),
                        'content_size' => $item->getContentSize(),
                        'encoding_format' => $item->getEncodingFormat(),
                    ];
                    // Add optional fields only if they are set
                    if (! empty($item->getHostPageUrl())) {
                        $itemArray['host_page_url'] = $item->getHostPageUrl();
                    }
                    if (! empty($item->getThumbnailUrl())) {
                        $itemArray['thumbnail_url'] = $item->getThumbnailUrl();
                    }
                    if (! empty($item->getDatePublished())) {
                        $itemArray['date_published'] = $item->getDatePublished();
                    }
                    return $itemArray;
                }, $this->images->getValue()),
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
