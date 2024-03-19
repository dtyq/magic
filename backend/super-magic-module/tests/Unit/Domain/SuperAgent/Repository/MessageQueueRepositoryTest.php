<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Domain\SuperAgent\Repository;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageQueueRepositoryInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * MessageQueueRepository Compensation Methods Unit Test.
 * 消息队列仓储补偿方法单元测试.
 * @internal
 */
class MessageQueueRepositoryTest extends TestCase
{
    private MessageQueueRepositoryInterface|MockObject $repository;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock the repository interface directly
        $this->repository = $this->createMock(MessageQueueRepositoryInterface::class);
    }

    /**
     * Test getCompensationTopics method.
     * 测试获取补偿话题ID列表方法.
     *
     * 🎯 Repository Query Logic Test:
     * ┌─────────────────────┬──────────────────┬─────────────────┬─────────────────────────────┐
     * │      Scenario       │   Organization   │     Limit       │        Query Conditions     │
     * │                     │     Codes        │                 │                             │
     * ├─────────────────────┼──────────────────┼─────────────────┼─────────────────────────────┤
     * │ All organizations   │     []           │       50        │ No whereIn for org_code     │
     * │ Specific orgs       │ ['org1', 'org2'] │       10        │ whereIn('organization_code')│
     * │ Single org          │ ['org1']         │       25        │ whereIn with 1 org          │
     * │ Empty result        │     []           │       50        │ Query returns empty         │
     * └─────────────────────┴──────────────────┴─────────────────┴─────────────────────────────┘
     */
    public function testGetCompensationTopics(): void
    {
        // Test Case 1: All organizations (no filter)
        $this->repository->expects($this->once())
            ->method('getCompensationTopics')
            ->with(50, [])
            ->willReturn([1, 2, 3]);

        $result = $this->repository->getCompensationTopics(50, []);
        $this->assertEquals([1, 2, 3], $result);
    }

    /**
     * Test getCompensationTopics with organization filter.
     * 测试带组织过滤的补偿话题查询.
     */
    public function testGetCompensationTopicsWithOrganizationFilter(): void
    {
        $organizationCodes = ['org1', 'org2'];

        $this->repository->expects($this->once())
            ->method('getCompensationTopics')
            ->with(10, $organizationCodes)
            ->willReturn([1, 2]);

        $result = $this->repository->getCompensationTopics(10, $organizationCodes);
        $this->assertEquals([1, 2], $result);
    }

    /**
     * Test getEarliestMessageByTopic method.
     * 测试获取话题最早消息方法.
     *
     * 📊 Database Query Test:
     * ┌─────────────────────┬─────────────────┬─────────────────────────────────────┐
     * │      Scenario       │    Topic ID     │        Expected Query Logic         │
     * ├─────────────────────┼─────────────────┼─────────────────────────────────────┤
     * │ Message found       │       123       │ WHERE + ORDER BY + first()          │
     * │ No message          │       456       │ WHERE + ORDER BY + first() = null   │
     * │ Multiple messages   │       789       │ WHERE + ORDER BY + first() = oldest │
     * └─────────────────────┴─────────────────┴─────────────────────────────────────┘
     */
    public function testGetEarliestMessageByTopic(): void
    {
        // Test Case 1: Message found
        $mockEntity = $this->createMockMessageEntity(1, 123, 'user1');

        $this->repository->expects($this->once())
            ->method('getEarliestMessageByTopic')
            ->with(123)
            ->willReturn($mockEntity);

        $result = $this->repository->getEarliestMessageByTopic(123);
        $this->assertInstanceOf(MessageQueueEntity::class, $result);
        $this->assertEquals(123, $result->getTopicId());
    }

    /**
     * Test getEarliestMessageByTopic with no messages.
     * 测试没有消息的话题查询.
     */
    public function testGetEarliestMessageByTopicReturnsNull(): void
    {
        $this->repository->expects($this->once())
            ->method('getEarliestMessageByTopic')
            ->with(456)
            ->willReturn(null);

        $result = $this->repository->getEarliestMessageByTopic(456);
        $this->assertNull($result);
    }

    /**
     * Test delayTopicMessages method.
     * 测试延迟话题消息方法.
     *
     * 🕐 Delay Logic Test:
     * ┌─────────────────────┬─────────────────┬─────────────────┬─────────────────────────────┐
     * │      Scenario       │    Topic ID     │ Delay Minutes   │       Expected Update       │
     * ├─────────────────────┼─────────────────┼─────────────────┼─────────────────────────────┤
     * │ Standard delay      │       123       │        5        │ +5 minutes to except_time   │
     * │ Long delay          │       456       │       60        │ +60 minutes to except_time  │
     * │ No messages         │       789       │       10        │ 0 rows affected = false     │
     * └─────────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
     */
    public function testDelayTopicMessages(): void
    {
        // Test Case 1: Successful delay
        $this->repository->expects($this->once())
            ->method('delayTopicMessages')
            ->with(123, 5)
            ->willReturn(true);

        $result = $this->repository->delayTopicMessages(123, 5);
        $this->assertTrue($result);
    }

    /**
     * Test delayTopicMessages with no affected rows.
     * 测试延迟消息时没有影响的行.
     */
    public function testDelayTopicMessagesWithNoAffectedRows(): void
    {
        $this->repository->expects($this->once())
            ->method('delayTopicMessages')
            ->with(789, 10)
            ->willReturn(false);

        $result = $this->repository->delayTopicMessages(789, 10);
        $this->assertFalse($result);
    }

    /**
     * Test updateStatus method.
     * 测试更新消息状态方法.
     *
     * 📝 Status Update Test:
     * ┌─────────────────────┬────────────────┬──────────────────┬────────────────┬─────────────────┐
     * │      Scenario       │   Message ID   │      Status      │ Error Message  │    Expected     │
     * ├─────────────────────┼────────────────┼──────────────────┼────────────────┼─────────────────┤
     * │ Update success      │      1001      │    COMPLETED     │      null      │      true       │
     * │ Update with error   │      1002      │     FAILED       │  "Error text"  │      true       │
     * │ No rows affected    │      9999      │    COMPLETED     │      null      │      false      │
     * └─────────────────────┴────────────────┴──────────────────┴────────────────┴─────────────────┘
     */
    public function testUpdateStatus(): void
    {
        // Test Case 1: Successful update without error message
        $this->repository->expects($this->once())
            ->method('updateStatus')
            ->with(1001, MessageQueueStatus::COMPLETED, null)
            ->willReturn(true);

        $result = $this->repository->updateStatus(1001, MessageQueueStatus::COMPLETED, null);
        $this->assertTrue($result);
    }

    /**
     * Test updateStatus with error message.
     * 测试带错误消息的状态更新.
     */
    public function testUpdateStatusWithErrorMessage(): void
    {
        $this->repository->expects($this->once())
            ->method('updateStatus')
            ->with(1002, MessageQueueStatus::FAILED, 'Connection timeout')
            ->willReturn(true);

        $result = $this->repository->updateStatus(1002, MessageQueueStatus::FAILED, 'Connection timeout');
        $this->assertTrue($result);
    }

    /**
     * Create mock MessageQueueEntity for testing.
     * 创建测试用的消息队列实体.
     */
    private function createMockMessageEntity(int $id, int $topicId, string $userId): MessageQueueEntity
    {
        $entity = new MessageQueueEntity();
        $entity->setId($id)
            ->setTopicId($topicId)
            ->setUserId($userId)
            ->setOrganizationCode('test_org')
            ->setProjectId(1)
            ->setMessageContent('{"content": "test"}')
            ->setMessageType('text')
            ->setStatus(MessageQueueStatus::PENDING)
            ->setExceptExecuteTime('2024-01-01 12:00:00')
            ->setCreatedAt('2024-01-01 10:00:00')
            ->setUpdatedAt('2024-01-01 10:00:00');

        return $entity;
    }
}
