<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Dag;

class Vertex
{
    public string $key;

    /**
     * @var callable
     */
    public $value;

    /**
     * @var array<Vertex>
     */
    public array $parents = [];

    /**
     * @var array<Vertex>
     */
    public array $children = [];

    protected bool $isRoot = false;

    public static function make(callable $job, ?string $key = null): self
    {
        $closure = $job(...);
        if ($key === null) {
            $key = spl_object_hash($closure);
        }

        $v = new Vertex();
        $v->key = $key;
        $v->value = $closure;
        return $v;
    }

    public static function of(Runner $job, ?string $key = null): self
    {
        if ($key === null) {
            $key = spl_object_hash($job);
        }

        $v = new Vertex();
        $v->key = $key;
        $v->value = [$job, 'run'];
        return $v;
    }

    public function isRoot(): bool
    {
        return $this->isRoot;
    }

    /**
     * 标记为根节点.
     */
    public function markAsRoot(): void
    {
        $this->isRoot = true;
    }
}
