<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Dag;

use Hyperf\Context\Context;
use Hyperf\Engine\Coroutine;
use InvalidArgumentException;
use RuntimeException;
use SplQueue;
use SplStack;

class Dag implements Runner
{
    /**
     * 等待模式.（节点只允许运行一次）.
     */
    public const int WAITING_MODE = 1;

    /**
     * 非等待模式.（节点允许运行多次）.
     */
    public const int NON_WAITING_MODE = 2;

    /**
     * 并发运行.
     */
    public const int CONCURRENCY_RUNNING_MODE = 1;

    /**
     * 非并发运行.
     */
    public const int NON_CONCURRENCY_RUNNING_MODE = 2;

    /**
     * @var array<string,Vertex>
     */
    protected array $vertexes = [];

    /**
     * 节点等待模式.
     */
    protected int $nodeWaitingMode = self::WAITING_MODE;

    /**
     * 运行模式.
     */
    protected int $runningMode = self::CONCURRENCY_RUNNING_MODE;

    protected int $concurrency = 10;

    /**
     * @var array<string, array<VertexResult>>|array<string, VertexResult>
     */
    protected array $vertexResults = [];

    protected int $vertexNum;

    /**
     * @var array<int,array>
     */
    protected array $circularDependencies;

    protected SplStack $stack;

    /**
     * @var array<string,bool>
     */
    protected array $isInStack;

    /**
     * @var array<string,int>
     */
    protected array $dfn;

    /**
     * @var array<string,int>
     */
    protected array $low;

    protected int $time;

    public function setNodeWaitingMode(int $mode): self
    {
        $this->nodeWaitingMode = $mode;
        return $this;
    }

    public function getNodeWaitingMode(): int
    {
        return $this->nodeWaitingMode;
    }

    public function setRunningMode(int $mode): self
    {
        $this->runningMode = $mode;
        if ($mode === self::NON_CONCURRENCY_RUNNING_MODE) {
            $this->setNodeWaitingMode(self::NON_WAITING_MODE);
        }
        return $this;
    }

    public function getRunningMode(): int
    {
        return $this->runningMode;
    }

    public function addVertex(Vertex $vertex): self
    {
        $this->vertexes[$vertex->key] = $vertex;
        $this->vertexNum = count($this->vertexes);
        return $this;
    }

    public function addEdgeByKey(string $from, string $to): self
    {
        if (! isset($this->vertexes[$from]) || ! isset($this->vertexes[$to])) {
            return $this;
        }
        $this->addEdge($this->vertexes[$from], $this->vertexes[$to]);
        return $this;
    }

    public function addEdge(Vertex $from, Vertex $to): self
    {
        $from->children[] = $to;
        $to->parents[] = $from;
        return $this;
    }

    public function getVertex(string $key): ?Vertex
    {
        return $this->vertexes[$key] ?? null;
    }

    public function run(array $args = []): array
    {
        if ($this->checkCircularDependencies()) {
            throw new RuntimeException('Circular dependencies detected in the DAG.');
        }

        $this->vertexResults = $args;

        if ($this->runningMode === self::NON_CONCURRENCY_RUNNING_MODE) {
            foreach ($this->vertexes as $vertex) {
                if ($vertex->isRoot() && empty($vertex->parents)) {
                    $this->runVertexRecursively($vertex);
                }
            }
            return $this->vertexResults;
        }

        $queue = new SplQueue();
        $running = 0;

        // State for WAITING_MODE
        $finishedNodes = []; // key => bool
        $finishedParentCount = []; // key => int
        if ($this->nodeWaitingMode === self::WAITING_MODE) {
            foreach (array_keys($this->vertexes) as $key) {
                $finishedParentCount[$key] = 0;
            }
        }

        // Find root nodes and prime the queue
        foreach ($this->vertexes as $vertex) {
            if ($vertex->isRoot() && empty($vertex->parents)) {
                $queue->enqueue($vertex);
            }
        }

        if ($queue->isEmpty() && ! empty($this->vertexes)) {
            throw new InvalidArgumentException('No roots can be found in DAG. A root is a vertex with no parents marked with markAsRoot().');
        }

        // Main execution loop
        while (! $queue->isEmpty() || $running > 0) {
            if ($queue->isEmpty()) {
                usleep(1); // Wait for running jobs to add to the queue
                continue;
            }

            $vertex = $queue->dequeue();

            if ($this->nodeWaitingMode === self::WAITING_MODE) {
                if (isset($finishedNodes[$vertex->key])) {
                    continue;
                }
            }

            // The core execution logic for a single vertex
            $runFunc = function () use ($vertex, &$queue, &$finishedNodes, &$finishedParentCount) {
                // a. Execute the vertex's job
                /** @var VertexResult $result */
                $result = call_user_func($vertex->value, $this->vertexResults);

                // b. Store results
                if ($this->nodeWaitingMode === self::WAITING_MODE) {
                    $this->vertexResults[$vertex->key] = $result;
                } else {
                    $this->vertexResults[$vertex->key][] = $result;
                }
                $finishedNodes[$vertex->key] = true;

                // c. Handle children scheduling
                $childrenToScheduleFromCurrent = $result->getChildrenIds();

                foreach ($vertex->children as $child) {
                    if (! in_array($child->key, $childrenToScheduleFromCurrent, true)) {
                        continue;
                    }

                    if ($this->nodeWaitingMode === self::WAITING_MODE) {
                        ++$finishedParentCount[$child->key];
                        if ($finishedParentCount[$child->key] === count($child->parents)) {
                            // All parents finished. Now check the "AND" condition for scheduling.
                            $allParentsAgree = true;
                            foreach ($child->parents as $parent) {
                                /** @var VertexResult $parentResult */
                                $parentResult = $this->vertexResults[$parent->key];
                                if (! in_array($child->key, $parentResult->getChildrenIds(), true)) {
                                    $allParentsAgree = false;
                                    break;
                                }
                            }
                            if ($allParentsAgree) {
                                $queue->enqueue($child);
                            }
                        }
                    } else { // NON_WAITING_MODE
                        $queue->enqueue($child);
                    }
                }
            };

            // d. Dispatch execution
            if ($this->runningMode === self::CONCURRENCY_RUNNING_MODE) {
                ++$running;
                $fromCoroutineId = Coroutine::id();
                Coroutine::create(function () use ($runFunc, $fromCoroutineId, &$running) {
                    Context::copy($fromCoroutineId, ['request-id', 'x-b3-trace-id', 'FlowEventStreamManager::EventStream']);
                    try {
                        $runFunc();
                    } finally {
                        --$running;
                    }
                });
            } else { // NON_CONCURRENCY_RUNNING_MODE
                $runFunc();
            }
        }

        return array_filter($this->vertexResults, function ($value) {
            /* @phpstan-ignore-next-line */
            return $value instanceof VertexResult || (is_array($value) && ! empty($value));
        });
    }

    public function getConcurrency(): int
    {
        return $this->concurrency;
    }

    public function setConcurrency(int $concurrency): self
    {
        $this->concurrency = $concurrency;
        return $this;
    }

    public function checkCircularDependencies(): array
    {
        $this->circularDependencies = [];
        $this->isInStack = [];
        $this->dfn = [];
        $this->low = [];
        $this->time = 1;
        $this->stack = new SplStack();

        foreach ($this->vertexes as $vertex) {
            $this->dfn[$vertex->key] = 0;
            $this->low[$vertex->key] = 0;
            $this->isInStack[$vertex->key] = false;
        }

        foreach ($this->vertexes as $vertex) {
            if ($this->dfn[$vertex->key] === 0) {
                $this->_checkCircularDependencies($vertex);
            }
        }

        return $this->circularDependencies;
    }

    private function runVertexRecursively(Vertex $vertex): void
    {
        if ($this->nodeWaitingMode === self::WAITING_MODE && isset($this->vertexResults[$vertex->key])) {
            return;
        }

        /** @var VertexResult $result */
        $result = call_user_func($vertex->value, $this->vertexResults);

        if ($this->nodeWaitingMode === self::WAITING_MODE) {
            $this->vertexResults[$vertex->key] = $result;
        } else {
            $this->vertexResults[$vertex->key][] = $result;
        }

        $childrenToSchedule = $result->getChildrenIds();
        foreach ($vertex->children as $child) {
            if (in_array($child->key, $childrenToSchedule, true)) {
                $this->runVertexRecursively($child);
            }
        }
    }

    private function isConnected(Vertex $src, Vertex $dst): bool
    {
        return in_array($dst, $src->children, true);
    }

    private function _checkCircularDependencies(Vertex $vertexSrc): void
    {
        $this->dfn[$vertexSrc->key] = $this->low[$vertexSrc->key] = $this->time++;
        $this->stack->push($vertexSrc->key);
        $this->isInStack[$vertexSrc->key] = true;

        foreach ($this->vertexes as $vertexDst) {
            if ($this->isConnected($vertexSrc, $vertexDst)) {
                if ($this->dfn[$vertexDst->key] == 0) {
                    $this->_checkCircularDependencies($vertexDst);
                    $this->low[$vertexSrc->key] = min($this->low[$vertexSrc->key], $this->low[$vertexDst->key]);
                } elseif ($this->isInStack[$vertexDst->key]) {
                    $this->low[$vertexSrc->key] = min($this->low[$vertexSrc->key], $this->dfn[$vertexDst->key]);
                }
            }
        }

        if ($this->dfn[$vertexSrc->key] == $this->low[$vertexSrc->key]) {
            $scc = [];
            do {
                $vertexKey = $this->stack->top();
                $this->stack->pop();
                $this->isInStack[$vertexKey] = false;
                $scc[] = $vertexKey;
            } while ($vertexKey != $vertexSrc->key);

            if (count($scc) > 1) {
                $this->circularDependencies[] = $scc;
            }
        }
    }
}
