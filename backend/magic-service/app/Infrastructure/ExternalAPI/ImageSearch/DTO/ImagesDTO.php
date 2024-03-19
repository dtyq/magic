<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Images container for image search results.
 */
class ImagesDTO extends AbstractDTO
{
    protected int $totalEstimatedMatches = 0;

    /**
     * @var ImageResultItemDTO[]
     */
    protected array $value = [];

    public function getTotalEstimatedMatches(): int
    {
        return $this->totalEstimatedMatches;
    }

    public function setTotalEstimatedMatches(int $totalEstimatedMatches): void
    {
        $this->totalEstimatedMatches = $totalEstimatedMatches;
    }

    /**
     * @return ImageResultItemDTO[]
     */
    public function getValue(): array
    {
        return $this->value;
    }

    /**
     * @param ImageResultItemDTO[] $value
     */
    public function setValue(array $value): void
    {
        $this->value = $value;
    }

    /**
     * Add a single image result item.
     */
    public function addItem(ImageResultItemDTO $item): void
    {
        $this->value[] = $item;
    }
}
