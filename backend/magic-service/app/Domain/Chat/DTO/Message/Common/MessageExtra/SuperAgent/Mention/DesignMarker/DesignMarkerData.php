<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

/**
 * 设计标记数据.
 */
final class DesignMarkerData extends AbstractDTO implements MentionDataInterface
{
    /**
     * 图片路径.
     */
    protected string $image;

    /**
     * 标记标签.
     */
    protected string $label;

    /**
     * 标记类型（如：object）.
     */
    protected string $kind;

    /**
     * 标记点坐标（包含两个浮点数的数组，如 [0.64, 0.64]）.
     */
    protected ?array $mark = null;

    protected int $markType = 1;

    protected ?array $area = null;

    /**
     * 标记编号.
     */
    protected int $markNumber;

    /**
     * 边界框（包含 x, y, width, height 的数组）.
     */
    protected array $bbox;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /* Getters */
    public function getImage(): ?string
    {
        return $this->image ?? null;
    }

    public function getLabel(): ?string
    {
        return $this->label ?? null;
    }

    public function getKind(): ?string
    {
        return $this->kind ?? null;
    }

    public function getMark(): ?array
    {
        return $this->mark ?? null;
    }

    public function getMarkNumber(): ?int
    {
        return $this->markNumber ?? null;
    }

    public function getBbox(): ?array
    {
        return $this->bbox ?? null;
    }

    /* Setters */
    public function setImage(string $image): void
    {
        $this->image = $image;
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function setKind(string $kind): void
    {
        $this->kind = $kind;
    }

    public function setMark(?array $mark): void
    {
        $this->mark = $mark;
    }

    public function setMarkNumber(int $markNumber): void
    {
        $this->markNumber = $markNumber;
    }

    public function setBbox(array $bbox): void
    {
        $this->bbox = $bbox;
    }

    public function getArea(): ?array
    {
        return $this->area;
    }

    public function setArea(?array $area): void
    {
        $this->area = $area;
    }

    public function getMarkType(): int
    {
        return $this->markType;
    }

    public function setMarkType(int $markType): void
    {
        $this->markType = $markType;
    }
}
