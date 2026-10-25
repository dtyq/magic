<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SaveUserSlidesTemplateDTO extends AbstractDTO
{
    public string $id = '';

    public string $code = '';

    public string $sourceType = '';

    public ?string $categoryCode = null;

    public I18nTextDTO $label;

    public I18nTextDTO $description;

    public string $thumbnailFileKey = '';

    public ?string $thumbnailUrl = null;

    public array $colors = [];

    public ?string $collageFileKey = null;

    public ?string $collageUrl = null;

    public array $previewImageFileKeys = [];

    public array $previewImageUrls = [];

    public string $templateFileKey = '';

    public ?string $previewUrl = null;

    public int $status = 1;

    public array $tags = [];

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public function __construct(?array $data = null)
    {
        $this->setLabel(null);
        $this->setDescription(null);
        parent::__construct($data);
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id === null ? '' : (string) $id;
    }

    public function setLabel(null|array|I18nTextDTO $label): void
    {
        $this->label = $label instanceof I18nTextDTO ? $label : I18nTextDTO::fromArray($label ?? []);
    }

    public function setDescription(null|array|I18nTextDTO $description): void
    {
        $this->description = $description instanceof I18nTextDTO ? $description : I18nTextDTO::fromArray($description ?? []);
    }
}
