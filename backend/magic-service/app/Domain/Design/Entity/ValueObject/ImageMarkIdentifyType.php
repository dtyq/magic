<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

/**
 * 图片标记识别类型枚举.
 */
enum ImageMarkIdentifyType: int
{
    /**
     * 点标记模式.
     */
    case MARK = 1;

    /**
     * 区域框选模式.
     */
    case AREA = 2;

    /**
     * 获取所有类型值
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 从整型或字符串创建枚举实例.
     */
    public static function make(null|int|string $type): self
    {
        if (is_string($type)) {
            $type = (int) $type;
        }
        if (is_null($type)) {
            return self::MARK;
        }
        return self::tryFrom($type) ?? self::MARK;
    }

    /**
     * 判断是否为点标记模式.
     */
    public function isMark(): bool
    {
        return $this === self::MARK;
    }

    /**
     * 判断是否为区域框选模式.
     */
    public function isArea(): bool
    {
        return $this === self::AREA;
    }

    /**
     * 构建用户提示词.
     *
     * @param bool $isTemporaryFile 是否为临时文件
     * @param null|int $number 标记编号（可选）
     * @param null|array $mark 标记坐标（可选）
     * @param null|array $area 区域坐标（可选）
     * @return string 用户提示词
     */
    public function buildPrompt(bool $isTemporaryFile, ?int $number, ?array $mark, ?array $area): string
    {
        if ($isTemporaryFile) {
            // 临时文件：图片上已有标记
            return $this->buildTemporaryFilePrompt($number, $mark, $area);
        }

        // TaskFile：使用详细坐标提示词
        return $this->buildTaskFilePrompt($number, $mark, $area);
    }

    /**
     * 构建临时文件的提示词.
     */
    private function buildTemporaryFilePrompt(?int $number, ?array $mark, ?array $area): string
    {
        return match ($this) {
            self::MARK => $this->buildTemporaryFileMarkPrompt($number, $mark),
            self::AREA => $this->buildTemporaryFileAreaPrompt($number, $area),
        };
    }

    /**
     * 构建临时文件点标记提示词.
     */
    private function buildTemporaryFileMarkPrompt(?int $number, ?array $mark): string
    {
        // 构建标记描述
        $markDesc = $number !== null
            ? "具有{$number}数字的黑色水滴状标记"
            : '黑色水滴状标记';

        // 有辅助数据：带坐标描述
        if ($mark !== null) {
            ['xPercent' => $xPercent, 'yPercent' => $yPercent, 'positionDesc' => $positionDesc] = self::formatMarkCoordinates($mark);

            return "请识别图片中标记点位置的内容。注意：图片上的{$markDesc}是用户添加的标注，不是原图内容。该标记点位于坐标({$xPercent}%, {$yPercent}%)，{$positionDesc}。请识别该标记点正下方或最接近的具体对象，不要识别附近的相似物体。返回多层级JSON格式结果。";
        }

        // 无辅助数据：简单描述
        return "请识别图片中标记点位置的内容。注意：图片上的{$markDesc}是用户添加的标注，不是原图内容。请识别该标记点正下方或最接近的具体对象，不要识别附近的相似物体。返回多层级JSON格式结果。";
    }

    /**
     * 构建临时文件区域框选提示词.
     */
    private function buildTemporaryFileAreaPrompt(?int $number, ?array $area): string
    {
        // 构建框选描述
        $areaDesc = $number !== null
            ? "具有{$number}数字标注的白色矩形框"
            : '白色矩形框';

        // 有辅助数据：带坐标描述
        if ($area !== null) {
            ['xPercent' => $xPercent, 'yPercent' => $yPercent, 'wPercent' => $wPercent, 'hPercent' => $hPercent, 'positionDesc' => $positionDesc] = self::formatAreaCoordinates($area);

            return "请识别图片中框选区域的内容。注意：图片上的{$areaDesc}是用户添加的标注，不是原图内容。该框选区域范围：左上角坐标({$xPercent}%, {$yPercent}%)，宽度{$wPercent}px，高度{$hPercent}px，该区域位于{$positionDesc}。请识别该区域内的主要对象和内容，重点关注区域中心的元素。返回多层级JSON格式结果。";
        }

        // 无辅助数据：简单描述
        return "请识别图片中框选区域的内容。注意：图片上的{$areaDesc}是用户添加的标注，不是原图内容。请识别该区域内的主要对象和内容，重点关注区域中心的元素。返回多层级JSON格式结果。";
    }

    /**
     * 构建 TaskFile 的提示词（包含详细坐标）.
     */
    private function buildTaskFilePrompt(?int $number, ?array $mark, ?array $area): string
    {
        return match ($this) {
            self::MARK => $this->buildTaskFileMarkPrompt($number, $mark),
            self::AREA => $this->buildTaskFileAreaPrompt($number, $area),
        };
    }

    /**
     * 构建 TaskFile 点标记提示词.
     */
    private function buildTaskFileMarkPrompt(?int $number, array $mark): string
    {
        ['xPercent' => $xPercent, 'yPercent' => $yPercent, 'positionDesc' => $positionDesc] = self::formatMarkCoordinates($mark);

        $numberDesc = $number !== null ? "（{$number}号标记）" : '';

        return "识别图片坐标({$xPercent}%, {$yPercent}%)位置的内容{$numberDesc}，这个坐标是标记点的中心位置，位于{$positionDesc}。请识别标记点正下方或最接近的具体对象，不要识别附近的相似物体。返回多层级JSON格式结果。";
    }

    /**
     * 构建 TaskFile 区域框选提示词.
     */
    private function buildTaskFileAreaPrompt(?int $number, array $area): string
    {
        ['xPercent' => $xPercent, 'yPercent' => $yPercent, 'wPercent' => $wPercent, 'hPercent' => $hPercent, 'positionDesc' => $positionDesc] = self::formatAreaCoordinates($area);

        $numberDesc = $number !== null ? "（{$number}号标记）" : '';

        return "识别图片中框选区域的内容{$numberDesc}，区域范围：左上角坐标({$xPercent}%, {$yPercent}%)，宽度{$wPercent}px，高度{$hPercent}px，该区域位于{$positionDesc}。请识别框选区域内的主要对象和内容，重点关注区域中心的元素。返回多层级JSON格式结果。";
    }

    /**
     * 格式化点标记坐标.
     *
     * @param array $mark [x, y]
     * @return array ['xPercent' => float, 'yPercent' => float, 'positionDesc' => string]
     */
    private static function formatMarkCoordinates(array $mark): array
    {
        [$x, $y] = $mark;

        return [
            'xPercent' => round($x * 100, 2),
            'yPercent' => round($y * 100, 2),
            'positionDesc' => self::getPositionDescription($x, $y),
        ];
    }

    /**
     * 格式化区域框选坐标.
     *
     * @param array $area [x, y, w, h]
     * @return array ['xPercent' => float, 'yPercent' => float, 'wPercent' => float, 'hPercent' => float, 'positionDesc' => string]
     */
    private static function formatAreaCoordinates(array $area): array
    {
        [$x, $y, $w, $h] = $area;

        $centerX = $x + ($w / 2);
        $centerY = $y + ($h / 2);

        return [
            'xPercent' => round($x * 100, 2),
            'yPercent' => round($y * 100, 2),
            'wPercent' => round($w, 2),
            'hPercent' => round($h, 2),
            'positionDesc' => self::getPositionDescription($centerX, $centerY),
        ];
    }

    /**
     * 根据坐标获取位置描述（5x5网格，更精确）.
     */
    private static function getPositionDescription(float $x, float $y): string
    {
        // 垂直方向：5等分
        $verticalZones = ['最顶部', '上部', '中间', '下部', '最底部'];
        $vIndex = min(4, (int) ($y * 5));
        $vertical = $verticalZones[$vIndex];

        // 水平方向：5等分
        $horizontalZones = ['最左侧', '偏左', '中央', '偏右', '最右侧'];
        $hIndex = min(4, (int) ($x * 5));
        $horizontal = $horizontalZones[$hIndex];

        return "图片的{$vertical}、{$horizontal}位置";
    }
}
