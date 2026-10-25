<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SlidesTemplateTagItemDTO extends AbstractDTO
{
    public string $id = '';

    public string $name = '';

    public string $code = '';

    public I18nTextDTO $nameI18n;

    public string $parentId = '0';

    public string $nodeType = 'tag';

    public I18nTextDTO $descriptionI18n;

    public int $sort = 0;

    public int $templateCount = 0;

    public bool $isOfficial = false;

    public function __construct(?array $data = null)
    {
        $this->setNameI18n(null);
        $this->setDescriptionI18n(null);
        parent::__construct($data);
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id === null ? '' : (string) $id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(?string $code): void
    {
        $this->code = $code ?? '';
    }

    public function getNameI18n(): I18nTextDTO
    {
        return $this->nameI18n;
    }

    public function setNameI18n(null|array|I18nTextDTO $nameI18n): void
    {
        $this->nameI18n = $nameI18n instanceof I18nTextDTO ? $nameI18n : I18nTextDTO::fromArray($nameI18n ?? []);
    }

    public function getParentId(): string
    {
        return $this->parentId;
    }

    public function setParentId(null|int|string $parentId): void
    {
        $this->parentId = $parentId === null ? '0' : (string) $parentId;
    }

    public function getNodeType(): string
    {
        return $this->nodeType;
    }

    public function setNodeType(?string $nodeType): void
    {
        $this->nodeType = $nodeType ?? 'tag';
    }

    public function getDescriptionI18n(): I18nTextDTO
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(null|array|I18nTextDTO $descriptionI18n): void
    {
        $this->descriptionI18n = $descriptionI18n instanceof I18nTextDTO ? $descriptionI18n : I18nTextDTO::fromArray($descriptionI18n ?? []);
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        $this->sort = $sort === null ? 0 : (int) $sort;
    }

    public function getTemplateCount(): int
    {
        return $this->templateCount;
    }

    public function setTemplateCount(null|int|string $templateCount): void
    {
        $this->templateCount = $templateCount === null ? 0 : (int) $templateCount;
    }

    public function isOfficial(): bool
    {
        return $this->isOfficial;
    }

    public function setIsOfficial(bool $isOfficial): void
    {
        $this->isOfficial = $isOfficial;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }
}
