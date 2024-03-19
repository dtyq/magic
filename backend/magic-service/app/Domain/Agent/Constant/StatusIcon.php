<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum StatusIcon: string
{
    case IconPlayerPlayFilled = 'IconPlayerPlayFilled';
    case IconPlayerPauseFilled = 'IconPlayerPauseFilled';
    case IconPlayerStopFilled = 'IconPlayerStopFilled';
    case IconCircleCheckFilled = 'IconCircleCheckFilled';
    case IconAlertCircleFilled = 'IconAlertCircleFilled';
    case IconCircleXFilled = 'IconCircleXFilled';
    case IconPlayerPlay = 'IconPlayerPlay';
    case IconPlayerPause = 'IconPlayerPause';
    case IconPlayerStop = 'IconPlayerStop';
    case IconCircleCheck = 'IconCircleCheck';
    case IconAlertCircle = 'IconAlertCircle';
    case IconCircleX = 'IconCircleX';
    case IconBell = 'IconBell';
    case IconBellPause = 'IconBellPause';
    case IconBellCancel = 'IconBellCancel';
    case IconBellCheck = 'IconBellCheck';
    case IconBellPlus = 'IconBellPlus';
    case IconBellX = 'IconBellX';
    case IconClockPlay = 'IconClockPlay';
    case IconClockPause = 'IconClockPause';
    case IconClockStop = 'IconClockStop';
    case IconClockCheck = 'IconClockCheck';
    case IconClockPlus = 'IconClockPlus';
    case IconClockX = 'IconClockX';
    case IconFlag = 'IconFlag';
    case IconFlagPause = 'IconFlagPause';
    case IconFlagCancel = 'IconFlagCancel';
    case IconFlagCheck = 'IconFlagCheck';
    case IconFlagPlus = 'IconFlagPlus';
    case IconFlagX = 'IconFlagX';
    case IconHome = 'IconHome';
    case IconHomeEdit = 'IconHomeEdit';
    case IconHomeCancel = 'IconHomeCancel';
    case IconHomeCheck = 'IconHomeCheck';
    case IconHomeRibbon = 'IconHomeRibbon';
    case IconHomeX = 'IconHomeX';
    case IconHeart = 'IconHeart';
    case IconHeartPause = 'IconHeartPause';
    case IconHeartCancel = 'IconHeartCancel';
    case IconHeartCheck = 'IconHeartCheck';
    case IconHeartPlus = 'IconHeartPlus';
    case IconHeartX = 'IconHeartX';
    case IconWand = 'IconWand';

    /**
     * 从字符串获取图标实例.
     */
    public static function fromString(string $icon): self
    {
        return match ($icon) {
            self::IconPlayerPlayFilled->value => self::IconPlayerPlayFilled,
            self::IconPlayerPauseFilled->value => self::IconPlayerPauseFilled,
            self::IconPlayerStopFilled->value => self::IconPlayerStopFilled,
            self::IconCircleCheckFilled->value => self::IconCircleCheckFilled,
            self::IconAlertCircleFilled->value => self::IconAlertCircleFilled,
            self::IconCircleXFilled->value => self::IconCircleXFilled,
            self::IconPlayerPlay->value => self::IconPlayerPlay,
            self::IconPlayerPause->value => self::IconPlayerPause,
            self::IconPlayerStop->value => self::IconPlayerStop,
            self::IconCircleCheck->value => self::IconCircleCheck,
            self::IconAlertCircle->value => self::IconAlertCircle,
            self::IconCircleX->value => self::IconCircleX,
            self::IconBell->value => self::IconBell,
            self::IconBellPause->value => self::IconBellPause,
            self::IconBellCancel->value => self::IconBellCancel,
            self::IconBellCheck->value => self::IconBellCheck,
            self::IconBellPlus->value => self::IconBellPlus,
            self::IconBellX->value => self::IconBellX,
            self::IconClockPlay->value => self::IconClockPlay,
            self::IconClockPause->value => self::IconClockPause,
            self::IconClockStop->value => self::IconClockStop,
            self::IconClockCheck->value => self::IconClockCheck,
            self::IconClockPlus->value => self::IconClockPlus,
            self::IconClockX->value => self::IconClockX,
            self::IconFlag->value => self::IconFlag,
            self::IconFlagPause->value => self::IconFlagPause,
            self::IconFlagCancel->value => self::IconFlagCancel,
            self::IconFlagCheck->value => self::IconFlagCheck,
            self::IconFlagPlus->value => self::IconFlagPlus,
            self::IconFlagX->value => self::IconFlagX,
            self::IconHome->value => self::IconHome,
            self::IconHomeEdit->value => self::IconHomeEdit,
            self::IconHomeCancel->value => self::IconHomeCancel,
            self::IconHomeCheck->value => self::IconHomeCheck,
            self::IconHomeRibbon->value => self::IconHomeRibbon,
            self::IconHomeX->value => self::IconHomeX,
            self::IconHeart->value => self::IconHeart,
            self::IconHeartPause->value => self::IconHeartPause,
            self::IconHeartCancel->value => self::IconHeartCancel,
            self::IconHeartCheck->value => self::IconHeartCheck,
            self::IconHeartPlus->value => self::IconHeartPlus,
            self::IconHeartX->value => self::IconHeartX,
            self::IconWand->value => self::IconWand,
            default => ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_icon_invalid'),
        };
    }

    /**
     * 验证图标值是否有效.
     */
    public static function isValid(string $icon): bool
    {
        return in_array($icon, [
            self::IconPlayerPlayFilled->value,
            self::IconPlayerPauseFilled->value,
            self::IconPlayerStopFilled->value,
            self::IconCircleCheckFilled->value,
            self::IconAlertCircleFilled->value,
            self::IconCircleXFilled->value,
            self::IconPlayerPlay->value,
            self::IconPlayerPause->value,
            self::IconPlayerStop->value,
            self::IconCircleCheck->value,
            self::IconAlertCircle->value,
            self::IconCircleX->value,
            self::IconBell->value,
            self::IconBellPause->value,
            self::IconBellCancel->value,
            self::IconBellCheck->value,
            self::IconBellPlus->value,
            self::IconBellX->value,
            self::IconClockPlay->value,
            self::IconClockPause->value,
            self::IconClockStop->value,
            self::IconClockCheck->value,
            self::IconClockPlus->value,
            self::IconClockX->value,
            self::IconFlag->value,
            self::IconFlagPause->value,
            self::IconFlagCancel->value,
            self::IconFlagCheck->value,
            self::IconFlagPlus->value,
            self::IconFlagX->value,
            self::IconHome->value,
            self::IconHomeEdit->value,
            self::IconHomeCancel->value,
            self::IconHomeCheck->value,
            self::IconHomeRibbon->value,
            self::IconHomeX->value,
            self::IconHeart->value,
            self::IconHeartPause->value,
            self::IconHeartCancel->value,
            self::IconHeartCheck->value,
            self::IconHeartPlus->value,
            self::IconHeartX->value,
            self::IconWand->value,
        ], true);
    }

    /**
     * 获取所有可用的图标值.
     * @return array<string> 返回所有图标值
     */
    public static function getValues(): array
    {
        return [
            self::IconPlayerPlayFilled->value,
            self::IconPlayerPauseFilled->value,
            self::IconPlayerStopFilled->value,
            self::IconCircleCheckFilled->value,
            self::IconAlertCircleFilled->value,
            self::IconCircleXFilled->value,
            self::IconPlayerPlay->value,
            self::IconPlayerPause->value,
            self::IconPlayerStop->value,
            self::IconCircleCheck->value,
            self::IconAlertCircle->value,
            self::IconCircleX->value,
            self::IconBell->value,
            self::IconBellPause->value,
            self::IconBellCancel->value,
            self::IconBellCheck->value,
            self::IconBellPlus->value,
            self::IconBellX->value,
            self::IconClockPlay->value,
            self::IconClockPause->value,
            self::IconClockStop->value,
            self::IconClockCheck->value,
            self::IconClockPlus->value,
            self::IconClockX->value,
            self::IconFlag->value,
            self::IconFlagPause->value,
            self::IconFlagCancel->value,
            self::IconFlagCheck->value,
            self::IconFlagPlus->value,
            self::IconFlagX->value,
            self::IconHome->value,
            self::IconHomeEdit->value,
            self::IconHomeCancel->value,
            self::IconHomeCheck->value,
            self::IconHomeRibbon->value,
            self::IconHomeX->value,
            self::IconHeart->value,
            self::IconHeartPause->value,
            self::IconHeartCancel->value,
            self::IconHeartCheck->value,
            self::IconHeartPlus->value,
            self::IconHeartX->value,
        ];
    }
}
