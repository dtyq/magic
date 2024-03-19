<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\IntervalUnit;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\TopicConfig;
use DateTime;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class RoutineConfigTest extends BaseTest
{
    public function testNoRepeat()
    {
        $type = RoutineType::NoRepeat;
        $config = new RoutineConfig($type, '20280903', '08:00', deadline: new DateTime('20290903 08:00'));

        $this->assertEquals(new DateTime('20280903 08:00'), $config->getDatetime());
        $this->assertEquals('2029-09-03 08:00:00', $config->getDeadline()->format('Y-m-d H:i:s'));
    }

    public function testNoRepeatWithTopic()
    {
        $type = RoutineType::NoRepeat;
        $config = new RoutineConfig($type, '20280903', '08:00', deadline: new DateTime('20290903 08:00'), topicConfig: new TopicConfig('recent_topic', ComponentFactory::generateTemplate(StructureType::Value)));

        $this->assertEquals(new DateTime('20280903 08:00'), $config->getDatetime());
        $this->assertEquals('2029-09-03 08:00:00', $config->getDeadline()->format('Y-m-d H:i:s'));
        var_dump(json_encode($config->toConfigArray()));
    }

    public function testDailyRepeat()
    {
        $type = RoutineType::DailyRepeat;
        $config = new RoutineConfig($type, '', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * *', $rule);
    }

    public function testWeeklyRepeat()
    {
        $type = RoutineType::WeeklyRepeat;
        $config = new RoutineConfig($type, '3', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * 4', $rule);

        $config = new RoutineConfig($type, '0', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * 1', $rule);

        $config = new RoutineConfig($type, '6', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * 0', $rule);
    }

    public function testMonthlyRepeat()
    {
        $type = RoutineType::MonthlyRepeat;
        $config = new RoutineConfig($type, '3', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 3 * *', $rule);

        $config = new RoutineConfig($type, '31', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 31 * *', $rule);
    }

    public function testAnnuallyRepeat()
    {
        $type = RoutineType::AnnuallyRepeat;
        $config = new RoutineConfig($type, '20280903', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 03 09 *', $rule);

        $config = new RoutineConfig($type, '20280229', '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 29 02 *', $rule);
    }

    public function testWeekdayRepeat()
    {
        $type = RoutineType::WeekdayRepeat;
        $config = new RoutineConfig($type, null, '08:00');
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * 1-5', $rule);
    }

    public function testCustomRepeat()
    {
        $type = RoutineType::CustomRepeat;
        $config = new RoutineConfig($type, '20280903', '08:00', IntervalUnit::Day, 2);
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 */2 * *', $rule);

        $config = new RoutineConfig($type, '20280903', '08:00', IntervalUnit::Week, 2, [1, 3, 4]);
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 * * 1,3,4', $rule);

        $config = new RoutineConfig($type, '20280903', '08:00', IntervalUnit::Month, 2, [9, 20]);
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 9,20 * *', $rule);

        $config = new RoutineConfig($type, '20280903', '08:00', IntervalUnit::Year, 2);
        $rule = $config->getCrontabRule();
        $this->assertEquals('00 08 03 09 *', $rule);
    }
}
