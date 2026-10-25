<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SlidesTemplateSimpleTagItemDTO extends AbstractDTO
{
    public string $id = '';

    public string $code = '';

    public string $name = '';

    public I18nTextDTO $nameI18n;

    public int $sort = 0;

    public function __construct(?array $data = null)
    {
        $this->setNameI18n(null);
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getNameI18n(): I18nTextDTO
    {
        return $this->nameI18n;
    }

    public function setNameI18n(null|array|I18nTextDTO $nameI18n): void
    {
        $this->nameI18n = $nameI18n instanceof I18nTextDTO ? $nameI18n : I18nTextDTO::fromArray($nameI18n ?? []);
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        $this->sort = $sort === null ? 0 : (int) $sort;
    }
}
