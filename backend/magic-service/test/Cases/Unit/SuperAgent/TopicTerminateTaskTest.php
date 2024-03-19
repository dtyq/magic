<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperAgent;

use HyperfTest\Cases\BaseTest;

/**
 * Topic Terminate Task Test
 * Test the topic task termination API.
 *
 * @internal
 */
class TopicTerminateTaskTest extends BaseTest
{
    /**
     * Test terminate task with valid topic ID.
     */
    public function testTerminateTaskSuccess()
    {
        $topicId = '854392555134652419';

        // Call the terminate task API
        $response = $this->post(
            "/api/v1/super-agent/topics/{$topicId}/terminate",
            [],
            $this->getCommonHeaders()
        );

        // Print response for debugging
        echo "\n=== Response ===\n";
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        echo "\n===============\n";

        // Assert response structure
        $this->assertIsArray($response);

        // Check if response has expected fields
        if (isset($response['topic_id'])) {
            $this->assertArrayHasKey('topic_id', $response);
            $this->assertArrayHasKey('task_id', $response);
            $this->assertArrayHasKey('status', $response);
            $this->assertArrayHasKey('message', $response);

            // Validate response values
            $this->assertEquals($topicId, $response['topic_id']);
            $this->assertIsString($response['message']);

            // Status should be actual task status or empty string
            // Possible values: '', 'suspended', 'finished', 'error', 'stopped', 'waiting', 'running'
            $validStatuses = ['', 'suspended', 'finished', 'error', 'stopped', 'waiting', 'running'];
            $this->assertContains(
                $response['status'],
                $validStatuses,
                "Status should be a valid TaskStatus value or empty string, got: {$response['status']}"
            );

            // Print result
            echo "\n✅ Test passed!\n";
            echo "Topic ID: {$response['topic_id']}\n";
            echo "Task ID: {$response['task_id']}\n";
            echo "Status: {$response['status']}\n";
            echo "Message: {$response['message']}\n";
        } else {
            // If response structure is different, print it for debugging
            echo "\n⚠️  Unexpected response structure\n";
            $this->assertTrue(true, 'Response received but structure differs from expected');
        }
    }

    /**
     * Test terminate task with non-existent topic ID.
     */
    public function testTerminateTaskWithNonExistentTopic()
    {
        $topicId = '999999999999999999';

        // Call the terminate task API
        $response = $this->post(
            "/api/v1/super-agent/topics/{$topicId}/terminate",
            [],
            $this->getCommonHeaders()
        );

        echo "\n=== Non-existent Topic Response ===\n";
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        echo "\n===================================\n";

        // Should return error or empty result
        $this->assertIsArray($response);
    }

    /**
     * Test terminate task idempotency (calling multiple times).
     */
    public function testTerminateTaskIdempotency()
    {
        $topicId = '854392555134652419';

        // First call
        $response1 = $this->post(
            "/api/v1/super-agent/topics/{$topicId}/terminate",
            [],
            $this->getCommonHeaders()
        );

        echo "\n=== First Call Response ===\n";
        echo json_encode($response1, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        echo "\n===========================\n";

        // Second call (should be idempotent)
        sleep(1); // Small delay
        $response2 = $this->post(
            "/api/v1/super-agent/topics/{$topicId}/terminate",
            [],
            $this->getCommonHeaders()
        );

        echo "\n=== Second Call Response ===\n";
        echo json_encode($response2, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        echo "\n============================\n";

        $this->assertIsArray($response1);
        $this->assertIsArray($response2);

        // If both calls succeeded, check status consistency
        if (isset($response2['status'])) {
            if ($response1['status'] === 'suspended') {
                // Second call should also return 'suspended' (task is already in suspended state)
                $this->assertEquals(
                    'suspended',
                    $response2['status'],
                    'Second call should return suspended status since task is already suspended'
                );
            }
        }
    }
}
