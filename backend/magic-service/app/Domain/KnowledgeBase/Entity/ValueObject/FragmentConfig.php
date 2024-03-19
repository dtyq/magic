<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class FragmentConfig extends AbstractValueObject
{
    protected FragmentMode $mode;

    protected ?NormalFragmentConfig $normal = null;

    protected ?ParentChildFragmentConfig $parentChild = null;

    public function getMode(): FragmentMode
    {
        return $this->mode;
    }

    public function setMode(FragmentMode $mode): self
    {
        $this->mode = $mode;
        return $this;
    }

    public function getNormal(): ?NormalFragmentConfig
    {
        return $this->normal;
    }

    public function setNormal(?NormalFragmentConfig $normal): self
    {
        $this->normal = $normal;
        return $this;
    }

    public function getParentChild(): ?ParentChildFragmentConfig
    {
        return $this->parentChild;
    }

    public function setParentChild(?ParentChildFragmentConfig $parentChild): self
    {
        $this->parentChild = $parentChild;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $config = new self();
        $config->setMode(FragmentMode::from($data['mode']));

        if ($config->getMode() === FragmentMode::NORMAL && isset($data['normal'])) {
            $config->setNormal(NormalFragmentConfig::fromArray($data['normal']));
        } elseif ($config->getMode() === FragmentMode::PARENT_CHILD && isset($data['parent_child'])) {
            $config->setParentChild(ParentChildFragmentConfig::fromArray($data['parent_child']));
        }

        return $config;
    }
}
