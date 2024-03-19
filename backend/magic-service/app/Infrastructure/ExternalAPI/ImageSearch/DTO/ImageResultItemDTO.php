<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Individual image search result item.
 */
class ImageResultItemDTO extends AbstractDTO
{
    /**
     * Image URL (required).
     */
    protected string $contentUrl = '';

    /**
     * Image title/name (required).
     */
    protected string $name = '';

    /**
     * Image width in pixels (required).
     */
    protected int $width = 0;

    /**
     * Image height in pixels (required).
     */
    protected int $height = 0;

    /**
     * Image file size (required).
     */
    protected string $contentSize = '';

    /**
     * Image format/encoding (required).
     */
    protected string $encodingFormat = '';

    /**
     * Host page URL (optional).
     */
    protected string $hostPageUrl = '';

    /**
     * Thumbnail URL (optional).
     */
    protected string $thumbnailUrl = '';

    /**
     * Date published (optional).
     */
    protected string $datePublished = '';

    public function getContentUrl(): string
    {
        return $this->contentUrl;
    }

    public function setContentUrl(string $contentUrl): void
    {
        $this->contentUrl = $contentUrl;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getWidth(): int
    {
        return $this->width;
    }

    public function setWidth(int $width): void
    {
        $this->width = $width;
    }

    public function getHeight(): int
    {
        return $this->height;
    }

    public function setHeight(int $height): void
    {
        $this->height = $height;
    }

    public function getContentSize(): string
    {
        return $this->contentSize;
    }

    public function setContentSize(string $contentSize): void
    {
        $this->contentSize = $contentSize;
    }

    public function getEncodingFormat(): string
    {
        return $this->encodingFormat;
    }

    public function setEncodingFormat(string $encodingFormat): void
    {
        $this->encodingFormat = $encodingFormat;
    }

    public function getHostPageUrl(): string
    {
        return $this->hostPageUrl;
    }

    public function setHostPageUrl(string $hostPageUrl): void
    {
        $this->hostPageUrl = $hostPageUrl;
    }

    public function getThumbnailUrl(): string
    {
        return $this->thumbnailUrl;
    }

    public function setThumbnailUrl(string $thumbnailUrl): void
    {
        $this->thumbnailUrl = $thumbnailUrl;
    }

    public function getDatePublished(): string
    {
        return $this->datePublished;
    }

    public function setDatePublished(string $datePublished): void
    {
        $this->datePublished = $datePublished;
    }
}
