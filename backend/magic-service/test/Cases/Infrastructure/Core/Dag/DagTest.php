<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Infrastructure\Core\Dag;

use App\Infrastructure\Core\Dag\Dag;
use App\Infrastructure\Core\Dag\Vertex;
use App\Infrastructure\Core\Dag\VertexResult;
use Hyperf\Coroutine\Coroutine;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class DagTest extends BaseTest
{
    /**
     * 测试并行调度节点.
     */
    public function test1(): void
    {
        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);

        $result = $dag->run();
        $this->assertNotEmpty($result);

        // 因为vertex2的执行时间比vertex3长，所以vertex3会先执行，先输出结果
        $this->assertEquals(['vertex1', 'vertex3', 'vertex2'], array_keys($result));

        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);

        $result = $dag->run();
        $this->assertNotEmpty($result);

        // 因为vertex3的执行时间比vertex2长，所以vertex2会先执行，先输出结果
        $this->assertEquals(['vertex1', 'vertex2', 'vertex3'], array_keys($result));
    }

    /**
     * 测试条件调度节点.
     */
    public function test2(): void
    {
        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();

            // 只调度节点3
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);

        $result = $dag->run();
        $this->assertNotEmpty($result);

        $this->assertEquals(['vertex1', 'vertex3'], array_keys($result));

        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();

            // 只调度节点2
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);

        $result = $dag->run();
        $this->assertNotEmpty($result);

        $this->assertEquals(['vertex1', 'vertex2'], array_keys($result));
    }

    /**
     * 测试并发调度且等待父节点完成.
     * root -> vertex2
     * root -> vertex3
     * vertex2 -> vertex5
     * vertex3 -> vertex4
     * vertex4 -> vertex5.
     */
    public function test3(): void
    {
        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();

            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex5']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3')->setChildrenIds(['vertex4']);
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex4')->setChildrenIds(['vertex5']);
            return $vertexResult;
        }, 'vertex4');

        $vertex5 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex5');
            return $vertexResult;
        }, 'vertex5');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);
        $dag->addVertex($vertex5);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);
        $dag->addEdge($vertex2, $vertex5);
        $dag->addEdge($vertex3, $vertex4);
        $dag->addEdge($vertex4, $vertex5);

        $result = $dag->run();
        $this->assertNotEmpty($result);
        $this->assertEquals(['vertex1', 'vertex2', 'vertex3', 'vertex4', 'vertex5'], array_keys($result));
    }

    /**
     * 测试并发+条件调度节点.
     * root -> vertex2
     * root -> vertex3
     * vertex2 -> vertex5
     * vertex3 -> vertex4
     * vertex4 -> vertex5 （但是不调度）.
     */
    public function test4(): void
    {
        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();

            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex5']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3')->setChildrenIds(['vertex4']);
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex4');
            return $vertexResult;
        }, 'vertex4');

        $vertex5 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex5');
            return $vertexResult;
        }, 'vertex5');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);
        $dag->addVertex($vertex5);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);
        $dag->addEdge($vertex2, $vertex5);
        $dag->addEdge($vertex3, $vertex4);
        $dag->addEdge($vertex4, $vertex5);

        $result = $dag->run();
        $this->assertNotEmpty($result);
        $this->assertEquals(['vertex1', 'vertex2', 'vertex3', 'vertex4'], array_keys($result));
    }

    /**
     * 测试非并发模式.
     * vertex1 -> vertex2
     * vertex1 -> vertex3
     * vertex2 -> vertex4
     * vertex3 -> vertex5
     * vertex4 -> vertex6
     * vertex5 -> vertex6.
     */
    public function test5(): void
    {
        $dag = new Dag();

        $vertex1 = Vertex::make(function () {
            $vertexResult = new VertexResult();

            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $vertex1->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex4']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3')->setChildrenIds(['vertex5']);
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex4')->setChildrenIds(['vertex6']);
            return $vertexResult;
        }, 'vertex4');

        $vertex5 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex5')->setChildrenIds(['vertex6']);
            return $vertexResult;
        }, 'vertex5');

        $vertex6 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex6');
            return $vertexResult;
        }, 'vertex6');

        $dag->addVertex($vertex1);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);
        $dag->addVertex($vertex5);
        $dag->addVertex($vertex6);

        $dag->addEdge($vertex1, $vertex2);
        $dag->addEdge($vertex1, $vertex3);
        $dag->addEdge($vertex2, $vertex4);
        $dag->addEdge($vertex3, $vertex5);
        $dag->addEdge($vertex4, $vertex6);
        $dag->addEdge($vertex5, $vertex6);

        /** @var array<array<VertexResult>> $vertexResults */
        $vertexResults = $dag->setNodeWaitingMode(Dag::NON_WAITING_MODE)->run();
        $this->assertNotEmpty($vertexResults);

        $result = [];
        foreach ($vertexResults as $vertexResult) {
            foreach ($vertexResult as $item) {
                $result[] = $item->getResult();
            }
        }

        $this->assertEquals(['vertex1', 'vertex2', 'vertex3', 'vertex4', 'vertex5', 'vertex6', 'vertex6'], $result);
    }

    /**
     * 测试非并发模式.
     * vertex1 -> vertex2
     * vertex2 -> vertex3.
     */
    public function test6(): void
    {
        $dag = new Dag();

        $vertex1 = Vertex::make(function () {
            $vertexResult = new VertexResult();

            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $vertex1->markAsRoot();

        $vertex2 = Vertex::make(function () {
            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex3']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($vertex1);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($vertex1, $vertex2);
        $dag->addEdge($vertex2, $vertex3);

        /** @var array<array<VertexResult>> $vertexResults */
        $vertexResults = $dag->setRunningMode(Dag::NON_CONCURRENCY_RUNNING_MODE)->run();
        $this->assertNotEmpty($vertexResults);

        $result = [];
        foreach ($vertexResults as $vertexResult) {
            foreach ($vertexResult as $item) {
                $result[] = $item->getResult();
            }
        }
        $this->assertEquals(['vertex1', 'vertex2', 'vertex3'], $result);
    }

    /**
     * 测试非并发模式.
     * vertex1 -> vertex2（不调度）
     * vertex1 -> vertex3（调度）.
     * vertex1 -> vertex4（不调度）.
     *
     * 应该输出：vertex1, vertex3.
     */
    public function test7(): void
    {
        $dag = new Dag();

        $vertex1 = Vertex::make(function () {
            $vertexResult = new VertexResult();

            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $vertex1->markAsRoot();

        $vertex2 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex4');
            return $vertexResult;
        }, 'vertex4');

        $dag->addVertex($vertex1);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);

        $dag->addEdge($vertex1, $vertex2);
        $dag->addEdge($vertex1, $vertex3);
        $dag->addEdge($vertex1, $vertex4);

        /** @var array<array<VertexResult>> $vertexResults */
        $vertexResults = $dag->setRunningMode(Dag::NON_CONCURRENCY_RUNNING_MODE)->run();
        $this->assertNotEmpty($vertexResults);

        $result = [];
        foreach ($vertexResults as $vertexResult) {
            foreach ($vertexResult as $item) {
                $result[] = $item->getResult();
            }
        }

        $this->assertEquals(['vertex1', 'vertex3'], $result);
    }

    /**
     * 测试并行调度节点.
     */
    public function test8(): void
    {
        $dag = new Dag();

        $root = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () {
            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex4']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex3')->setChildrenIds(['vertex5']);
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex4')->setChildrenIds(['vertex6']);
            return $vertexResult;
        }, 'vertex4');

        $vertex5 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex5')->setChildrenIds(['vertex6']);
            return $vertexResult;
        }, 'vertex5');

        $vertex6 = Vertex::make(function () {
            $vertexResult = new VertexResult();
            $vertexResult->setResult('vertex6');
            return $vertexResult;
        }, 'vertex6');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);
        $dag->addVertex($vertex5);
        $dag->addVertex($vertex6);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);
        $dag->addEdge($vertex2, $vertex4);
        $dag->addEdge($vertex3, $vertex5);
        $dag->addEdge($vertex4, $vertex6);
        $dag->addEdge($vertex5, $vertex6);

        $result = $dag->run();
        $this->assertNotEmpty($result);

        // 因为vertex2的执行时间比vertex3长，所以vertex3会先执行，先输出结果
        $this->assertEquals(['vertex1', 'vertex3', 'vertex5', 'vertex2', 'vertex4', 'vertex6'], array_keys($result));
    }

    public function test9()
    {
        $dag = new Dag();
        // 恢复并发模式
        //        $dag->setRunningMode(Dag::NON_CONCURRENCY_RUNNING_MODE);

        $edges = [
            ['A', 'B'],
            ['A', 'C'],
            ['B', 'D'],
            ['C', 'D'],
            ['D', 'E'],
            ['D', 'F'],
        ];

        // A -> B、C -> D -> E、F

        $nodes = [];
        foreach ($edges as $edge) {
            $from = $edge[0];
            $to = $edge[1];
            $nodes[$from][] = $to;
            if (! isset($nodes[$to])) {
                $nodes[$to] = [];
            }
        }
        $vertexList = [];
        foreach ($nodes as $nodeId => $childrenIds) {
            $nodeId = (string) $nodeId;
            $vertexList[$nodeId] = Vertex::make(function () use ($nodeId, $childrenIds) {
                $result = new VertexResult();
                $result->setChildrenIds($childrenIds);
                $coId = \Hyperf\Engine\Coroutine::id();
                echo "[{$coId}]Running node: {$nodeId}  Children: " . implode(', ', $childrenIds) . "\n";
                return $result;
            }, $nodeId);

            $dag->addVertex($vertexList[$nodeId]);
        }
        $vertexList['A']->markAsRoot();

        foreach ($edges as $edge) {
            $from = $edge[0];
            $to = $edge[1];
            $dag->addEdge($vertexList[$from], $vertexList[$to]);
        }

        $result = $dag->run();

        $this->assertEquals(['A', 'B', 'C', 'D', 'E', 'F'], array_keys($result));
    }
}
