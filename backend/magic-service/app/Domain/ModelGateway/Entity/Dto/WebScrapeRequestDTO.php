<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use RuntimeException;

/**
 * Web Scrape request DTO - encapsulates web scraping parameters.
 */
class WebScrapeRequestDTO extends AbstractRequestDTO
{
    /**
     * Target URL to scrape.
     */
    private string $url = '';

    /**
     * Output formats array (e.g., ['TEXT', 'MARKDOWN', 'HTML']).
     */
    private array $formats = ['TEXT'];

    /**
     * Scrape mode (e.g., 'quality', 'fast').
     */
    private string $mode = 'quality';

    /**
     * Additional options for scraping.
     */
    private array $options = [];

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        $this->url = (string) ($data['url'] ?? '');
        $this->formats = $data['formats'] ?? ['TEXT'];

        // Ensure formats is an array
        if (! is_array($this->formats)) {
            $this->formats = [$this->formats];
        }

        $this->mode = (string) ($data['mode'] ?? 'quality');
        $this->options = $data['options'] ?? [];
    }

    public static function createDTO(array $data): self
    {
        $webScrapeRequestDTO = new self();
        $webScrapeRequestDTO->setUrl((string) ($data['url'] ?? ''));

        $formats = $data['formats'] ?? ['TEXT'];
        if (! is_array($formats)) {
            $formats = [$formats];
        }
        $webScrapeRequestDTO->setFormats($formats);

        $webScrapeRequestDTO->setMode((string) ($data['mode'] ?? 'quality'));
        $webScrapeRequestDTO->setOptions($data['options'] ?? []);

        return $webScrapeRequestDTO;
    }

    public function getType(): string
    {
        return 'web_scrape';
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): self
    {
        $this->url = $url;
        return $this;
    }

    public function getFormats(): array
    {
        return $this->formats;
    }

    public function setFormats(array $formats): self
    {
        $this->formats = $formats;
        return $this;
    }

    public function getMode(): string
    {
        return $this->mode;
    }

    public function setMode(string $mode): self
    {
        $this->mode = $mode;
        return $this;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function setOptions(array $options): self
    {
        $this->options = $options;
        return $this;
    }

    /**
     * Validate web scrape parameters.
     *
     * @throws RuntimeException
     */
    public function validate(): void
    {
        if (empty($this->url)) {
            throw new RuntimeException('URL is required for web scraping');
        }

        if (! filter_var($this->url, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('Invalid URL format');
        }

        if (empty($this->formats)) {
            throw new RuntimeException('At least one format must be specified');
        }
    }
}
