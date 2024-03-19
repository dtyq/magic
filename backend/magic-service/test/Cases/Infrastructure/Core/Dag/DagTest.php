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
     * Test coroutine ID consistency in concurrent mode.
     * In concurrent mode, different vertices should run in different coroutines.
     */
    public function testConcurrentModeCoroutineIds(): void
    {
        $dag = new Dag();
        $coroutineIds = [];

        $root = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex1'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex2'] = $coroutineId;

            Coroutine::sleep(0.1); // Add small delay to ensure concurrent execution
            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex3'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $dag->addVertex($root);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);

        $dag->addEdge($root, $vertex2);
        $dag->addEdge($root, $vertex3);

        // Run in concurrent mode (default)
        $result = $dag->run();

        $this->assertNotEmpty($result);
        $this->assertCount(3, $result);

        // Assert that vertex2 and vertex3 run in different coroutines from vertex1
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex2'], 'vertex2 should run in different coroutine from vertex1');
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex3'], 'vertex3 should run in different coroutine from vertex1');

        // Verify coroutine IDs are stored in debug logs
        $this->assertEquals($coroutineIds['vertex1'], $result['vertex1']->getDebugLog()['coroutine_id']);
        $this->assertEquals($coroutineIds['vertex2'], $result['vertex2']->getDebugLog()['coroutine_id']);
        $this->assertEquals($coroutineIds['vertex3'], $result['vertex3']->getDebugLog()['coroutine_id']);
    }

    /**
     * Test coroutine ID consistency in non-concurrent mode.
     * In non-concurrent mode, all vertices should run in the same coroutine.
     */
    public function testNonConcurrentModeCoroutineIds(): void
    {
        $dag = new Dag();
        $coroutineIds = [];

        $vertex1 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex1'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $vertex1->markAsRoot();

        $vertex2 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex2'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex2')->setChildrenIds(['vertex4']);
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex3'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex3');
            return $vertexResult;
        }, 'vertex3');

        $vertex4 = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex4'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('vertex4');
            return $vertexResult;
        }, 'vertex4');

        $dag->addVertex($vertex1);
        $dag->addVertex($vertex2);
        $dag->addVertex($vertex3);
        $dag->addVertex($vertex4);

        $dag->addEdge($vertex1, $vertex2);
        $dag->addEdge($vertex1, $vertex3);
        $dag->addEdge($vertex2, $vertex4);

        // Set to non-concurrent mode
        $dag->setRunningMode(Dag::NON_CONCURRENCY_RUNNING_MODE);

        /** @var array<array<VertexResult>> $vertexResults */
        $vertexResults = $dag->run();

        $this->assertNotEmpty($vertexResults);

        // In non-concurrent mode, all vertices should run in the same coroutine
        $firstCoroutineId = $coroutineIds['vertex1'];
        $this->assertEquals($firstCoroutineId, $coroutineIds['vertex2'], 'All vertices should run in same coroutine in non-concurrent mode');
        $this->assertEquals($firstCoroutineId, $coroutineIds['vertex3'], 'All vertices should run in same coroutine in non-concurrent mode');
        $this->assertEquals($firstCoroutineId, $coroutineIds['vertex4'], 'All vertices should run in same coroutine in non-concurrent mode');

        // Verify coroutine IDs are stored in debug logs
        foreach ($vertexResults as $resultArray) {
            foreach ($resultArray as $result) {
                $this->assertEquals($firstCoroutineId, $result->getDebugLog()['coroutine_id']);
            }
        }
    }

    /**
     * Test mixed execution with coroutine tracking.
     * Complex DAG with both parallel and sequential execution.
     */
    public function testMixedExecutionCoroutineIds(): void
    {
        $dag = new Dag();
        $coroutineIds = [];

        // Create a complex DAG: A -> (B, C) -> D -> (E, F)
        $vertexA = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['A'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('A')->setChildrenIds(['B', 'C']);
            return $vertexResult;
        }, 'A');
        $vertexA->markAsRoot();

        $vertexB = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['B'] = $coroutineId;

            Coroutine::sleep(0.05); // Small delay
            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('B')->setChildrenIds(['D']);
            return $vertexResult;
        }, 'B');

        $vertexC = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['C'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('C')->setChildrenIds(['D']);
            return $vertexResult;
        }, 'C');

        $vertexD = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['D'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('D')->setChildrenIds(['E', 'F']);
            return $vertexResult;
        }, 'D');

        $vertexE = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['E'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('E');
            return $vertexResult;
        }, 'E');

        $vertexF = Vertex::make(function () use (&$coroutineIds) {
            $coroutineId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['F'] = $coroutineId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coroutineId);
            $vertexResult->setResult('F');
            return $vertexResult;
        }, 'F');

        foreach ([$vertexA, $vertexB, $vertexC, $vertexD, $vertexE, $vertexF] as $vertex) {
            $dag->addVertex($vertex);
        }

        $dag->addEdge($vertexA, $vertexB);
        $dag->addEdge($vertexA, $vertexC);
        $dag->addEdge($vertexB, $vertexD);
        $dag->addEdge($vertexC, $vertexD);
        $dag->addEdge($vertexD, $vertexE);
        $dag->addEdge($vertexD, $vertexF);

        $result = $dag->run();

        $this->assertNotEmpty($result);
        $this->assertCount(6, $result);

        // In concurrent mode:
        // - A runs first in one coroutine
        // - B and C should run in different coroutines (parallel)
        // - D waits for both B and C, runs in its own coroutine
        // - E and F should run in different coroutines (parallel)

        $this->assertNotEquals($coroutineIds['A'], $coroutineIds['B'], 'B should run in different coroutine from A');
        $this->assertNotEquals($coroutineIds['A'], $coroutineIds['C'], 'C should run in different coroutine from A');
        $this->assertNotEquals($coroutineIds['B'], $coroutineIds['C'], 'B and C should run in different coroutines (parallel)');

        // D should run in its own coroutine after B and C complete
        $this->assertNotEquals($coroutineIds['D'], $coroutineIds['A'], 'D should run in different coroutine');
        $this->assertNotEquals($coroutineIds['D'], $coroutineIds['B'], 'D should run in different coroutine');
        $this->assertNotEquals($coroutineIds['D'], $coroutineIds['C'], 'D should run in different coroutine');

        // E and F should run in different coroutines (parallel)
        $this->assertNotEquals($coroutineIds['E'], $coroutineIds['F'], 'E and F should run in different coroutines (parallel)');

        // Verify all coroutine IDs are different (showing true concurrent execution)
        $allCoroutineIds = array_values($coroutineIds);
        $uniqueCoroutineIds = array_unique($allCoroutineIds);
        $this->assertCount(6, $uniqueCoroutineIds, 'All vertices should run in different coroutines in concurrent mode');
    }

    /**
     * 测试并行调度节点 - Test parallel node scheduling with coroutine ID tracking.
     */
    public function test1(): void
    {
        // First test: vertex2 sleeps longer, so vertex3 finishes first
        $dag = new Dag();
        $coroutineIds = [];

        $root = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex1'] = $coId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex2'] = $coId;

            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex3'] = $coId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
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

        // Verify concurrent execution - vertex2 and vertex3 should run in different coroutines
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex2'], 'vertex2 should run in different coroutine');
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex3'], 'vertex3 should run in different coroutine');
        $this->assertNotEquals($coroutineIds['vertex2'], $coroutineIds['vertex3'], 'vertex2 and vertex3 should run in different coroutines (parallel)');

        // Second test: vertex3 sleeps longer, so vertex2 finishes first
        $dag = new Dag();
        $coroutineIds = [];

        $root = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex1'] = $coId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
            $vertexResult->setResult('vertex1')->setChildrenIds(['vertex2', 'vertex3']);
            return $vertexResult;
        }, 'vertex1');
        $root->markAsRoot();

        $vertex2 = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex2'] = $coId;

            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
            $vertexResult->setResult('vertex2');
            return $vertexResult;
        }, 'vertex2');

        $vertex3 = Vertex::make(function () use (&$coroutineIds) {
            $coId = \Hyperf\Engine\Coroutine::id();
            $coroutineIds['vertex3'] = $coId;

            Coroutine::sleep(1);
            $vertexResult = new VertexResult();
            $vertexResult->addDebugLog('coroutine_id', $coId);
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

        // Verify concurrent execution again
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex2'], 'vertex2 should run in different coroutine');
        $this->assertNotEquals($coroutineIds['vertex1'], $coroutineIds['vertex3'], 'vertex3 should run in different coroutine');
        $this->assertNotEquals($coroutineIds['vertex2'], $coroutineIds['vertex3'], 'vertex2 and vertex3 should run in different coroutines (parallel)');
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

    /**
     * Test complex DAG execution with coroutine ID tracking.
     * Tests both concurrent and non-concurrent modes with coroutine assertions.
     */
    public function test9()
    {
        // Test concurrent mode first
        $this->runComplexDagTest(true);

        // Test non-concurrent mode
        $this->runComplexDagTest(false);
    }

    /**
     * Helper method to run complex DAG test with coroutine tracking.
     */
    private function runComplexDagTest(bool $concurrent): void
    {
        $dag = new Dag();
        $coroutineIds = [];

        if (! $concurrent) {
            $dag->setRunningMode(Dag::NON_CONCURRENCY_RUNNING_MODE);
        }

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
            $vertexList[$nodeId] = Vertex::make(function () use ($nodeId, $childrenIds, &$coroutineIds) {
                $coId = \Hyperf\Engine\Coroutine::id();
                $coroutineIds[$nodeId] = $coId;

                $result = new VertexResult();
                $result->setChildrenIds($childrenIds);
                $result->addDebugLog('coroutine_id', $coId);
                $result->setResult($nodeId);

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

        // Basic execution order test
        if ($concurrent) {
            // In concurrent mode, execution order should be: A, B, C, D, E, F
            $this->assertEquals(['A', 'B', 'C', 'D', 'E', 'F'], array_keys($result));
        } else {
            // In non-concurrent mode, execution order may be different due to recursive execution
            // Just verify all nodes are executed
            $expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
            $actualNodes = array_keys($result);
            sort($expectedNodes);
            sort($actualNodes);
            $this->assertEquals($expectedNodes, $actualNodes, 'All nodes should be executed');
        }

        // Coroutine ID consistency tests
        if ($concurrent) {
            // In concurrent mode, verify that different vertices run in different coroutines
            $allCoroutineIds = array_values($coroutineIds);
            $uniqueCoroutineIds = array_unique($allCoroutineIds);

            // At minimum, B and C should run in different coroutines (parallel execution)
            $this->assertNotEquals($coroutineIds['B'], $coroutineIds['C'], 'B and C should run in different coroutines in concurrent mode');

            // E and F should also run in different coroutines (parallel execution)
            $this->assertNotEquals($coroutineIds['E'], $coroutineIds['F'], 'E and F should run in different coroutines in concurrent mode');

            // Most vertices should run in different coroutines due to parallel execution
            $this->assertGreaterThan(3, count($uniqueCoroutineIds), 'Should have multiple different coroutines in concurrent mode');
        } else {
            // In non-concurrent mode, all vertices should run in the same coroutine
            $firstCoroutineId = $coroutineIds['A'];
            foreach ($coroutineIds as $nodeId => $coId) {
                $this->assertEquals($firstCoroutineId, $coId, "Node {$nodeId} should run in same coroutine as A in non-concurrent mode");
            }

            $allCoroutineIds = array_values($coroutineIds);
            $uniqueCoroutineIds = array_unique($allCoroutineIds);
            $this->assertCount(1, $uniqueCoroutineIds, 'All vertices should run in same coroutine in non-concurrent mode');
        }

        // Verify coroutine IDs are stored in debug logs
        foreach ($result as $nodeId => $vertexResult) {
            if ($concurrent) {
                $this->assertEquals($coroutineIds[$nodeId], $vertexResult->getDebugLog()['coroutine_id'], "Debug log should contain correct coroutine ID for node {$nodeId}");
            } else {
                // In non-concurrent mode, all results should have arrays of VertexResult
                if (is_array($vertexResult)) {
                    foreach ($vertexResult as $vr) {
                        $this->assertArrayHasKey('coroutine_id', $vr->getDebugLog());
                    }
                } else {
                    $this->assertArrayHasKey('coroutine_id', $vertexResult->getDebugLog());
                }
            }
        }
    }
}
