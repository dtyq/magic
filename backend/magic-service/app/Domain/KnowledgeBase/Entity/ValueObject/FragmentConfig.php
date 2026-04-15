<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class FragmentConfig extends AbstractValueObject
{
    protected FragmentMode $mode = FragmentMode::AUTO;

    protected ?NormalFragmentConfig $normal = null;

    protected ?HierarchyFragmentConfig $hierarchy = null;

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

    public function getHierarchy(): ?HierarchyFragmentConfig
    {
        return $this->hierarchy;
    }

    public function setHierarchy(?HierarchyFragmentConfig $hierarchy): self
    {
        $this->hierarchy = $hierarchy;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $config = new self();

        $modeValue = $data['mode'] ?? FragmentMode::AUTO->value;
        $mode = FragmentMode::tryFrom($modeValue) ?? FragmentMode::AUTO;
        $config->setMode($mode);

        match ($config->getMode()) {
            FragmentMode::CUSTOM => self::hydrateNormalConfig($config, $data),
            FragmentMode::AUTO => self::hydrateAutoConfig($config, $data),
            FragmentMode::HIERARCHY => self::hydrateHierarchyConfig($config, $data),
        };

        return $config;
    }

    private static function hydrateNormalConfig(self $config, array $data): void
    {
        if (isset($data['normal'])) {
            $config->setNormal(NormalFragmentConfig::fromArray($data['normal']));
            return;
        }
        if (isset($data['chunk_size']) || isset($data['chunk_overlap']) || isset($data['chunk_overlap_unit']) || isset($data['separator'])) {
            $normal = new NormalFragmentConfig();
            $segment = new SegmentRule();
            $segment->setChunkSize($data['chunk_size'] ?? 0);
            $segment->setChunkOverlap($data['chunk_overlap'] ?? 0);
            $segment->setChunkOverlapUnit($data['chunk_overlap_unit'] ?? 'absolute');
            $segment->setSeparator($data['separator'] ?? '');
            $normal->setSegmentRule($segment);
            $normal->setTextPreprocessRule([]);
            $config->setNormal($normal);
        }
    }

    private static function hydrateAutoConfig(self $config, array $data): void
    {
        if (isset($data['normal'])) {
            $config->setNormal(NormalFragmentConfig::fromArray($data['normal']));
        }
    }

    private static function hydrateHierarchyConfig(self $config, array $data): void
    {
        if (isset($data['hierarchy'])) {
            $config->setHierarchy(HierarchyFragmentConfig::fromArray($data['hierarchy']));
        }
    }
}
