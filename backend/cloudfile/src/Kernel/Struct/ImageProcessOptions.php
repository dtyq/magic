<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use InvalidArgumentException;

/**
 * 统一的图片处理选项类，用于抹平不同云存储服务商的差异
 * 支持 OSS、TOS 等云存储服务
 */
class ImageProcessOptions
{
    // ========== 基础操作 ==========

    /**
     * 图片缩放配置.
     * @var null|array ['width' => 300, 'height' => 200, 'mode' => 'lfit']
     *                 mode: lfit (默认)|mfit|fill|pad|fixed
     *                 Note: File service max is 16384, direct OSS/TOS supports up to 30000
     */
    private ?array $resize = null;

    /**
     * 图片质量 (1-100).
     */
    private ?int $quality = null;

    /**
     * 目标格式.
     * @var null|string jpg|png|webp|bmp|gif|tiff|heif|avif
     */
    private ?string $format = null;

    /**
     * 旋转角度 (0-360, 顺时针).
     */
    private ?int $rotate = null;

    // ========== 裁剪操作 ==========

    /**
     * 裁剪配置.
     * @var null|array ['x' => 0, 'y' => 0, 'width' => 100, 'height' => 100]
     */
    private ?array $crop = null;

    /**
     * 内切圆半径.
     */
    private ?int $circle = null;

    /**
     * 索引切割配置.
     * @var null|array ['axis' => 'x'|'y', 'length' => 100, 'index' => 1]
     */
    private ?array $indexcrop = null;

    /**
     * 圆角矩形半径.
     */
    private ?int $roundedCorners = null;

    // ========== 水印和效果 ==========

    /**
     * 水印配置.
     * @var null|array ['type' => 'text'|'image', 'content' => '...', 'position' => '...', ...]
     */
    private ?array $watermark = null;

    /**
     * 模糊配置.
     * @var null|array ['radius' => 3, 'sigma' => 2]
     */
    private ?array $blur = null;

    /**
     * 锐化值 (50-399).
     */
    private ?int $sharpen = null;

    // ========== 颜色调整 ==========

    /**
     * 亮度 (-100 到 100).
     */
    private ?int $bright = null;

    /**
     * 对比度 (-100 到 100).
     */
    private ?int $contrast = null;

    // ========== 信息和其他 ==========

    /**
     * 获取图片信息.
     */
    private bool $info = false;

    /**
     * 获取图片主色调.
     */
    private bool $averageHue = false;

    /**
     * 自适应方向 (0|1).
     */
    private ?int $autoOrient = null;

    /**
     * 渐进显示 (0|1).
     */
    private ?int $interlace = null;

    // ========== 向下兼容 ==========

    /**
     * 原始处理字符串（用于向下兼容）
     * 设置后，将优先使用此值，忽略其他所有选项.
     */
    private ?string $raw = null;

    /**
     * Alias for toString().
     */
    public function __toString(): string
    {
        return $this->toString();
    }

    // ========== 链式设置方法 ==========

    public function resize(?array $config): self
    {
        if ($config !== null) {
            // 验证模式
            if (isset($config['mode'])) {
                $validModes = ['lfit', 'mfit', 'fill', 'pad', 'fixed'];
                if (! in_array($config['mode'], $validModes, true)) {
                    throw new InvalidArgumentException('resize mode must be one of: ' . implode(', ', $validModes));
                }
            }

            // 验证宽度
            if (isset($config['width']) && ($config['width'] < 1 || $config['width'] > 30000)) {
                throw new InvalidArgumentException('resize width must be between 1 and 30000');
            }

            // 验证高度
            if (isset($config['height']) && ($config['height'] < 1 || $config['height'] > 30000)) {
                throw new InvalidArgumentException('resize height must be between 1 and 30000');
            }

            // 验证长边限制
            if (isset($config['limit']) && ($config['limit'] < 1 || $config['limit'] > 30000)) {
                throw new InvalidArgumentException('resize limit must be between 1 and 30000');
            }

            // 验证短边限制
            if (isset($config['short']) && ($config['short'] < 1 || $config['short'] > 30000)) {
                throw new InvalidArgumentException('resize short must be between 1 and 30000');
            }

            // 验证百分比
            if (isset($config['percentage']) && ($config['percentage'] < 1 || $config['percentage'] > 1000)) {
                throw new InvalidArgumentException('resize percentage must be between 1 and 1000');
            }
        }

        $this->resize = $config;
        return $this;
    }

    public function quality(?int $quality): self
    {
        if ($quality !== null && ($quality < 1 || $quality > 100)) {
            throw new InvalidArgumentException('quality must be between 1 and 100');
        }

        $this->quality = $quality;
        return $this;
    }

    public function format(?string $format): self
    {
        if ($format !== null) {
            $validFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'heif', 'avif'];
            if (! in_array(strtolower($format), $validFormats, true)) {
                throw new InvalidArgumentException('format must be one of: ' . implode(', ', $validFormats));
            }
        }

        $this->format = $format;
        return $this;
    }

    public function rotate(?int $rotate): self
    {
        if ($rotate !== null && ($rotate < 0 || $rotate > 360)) {
            throw new InvalidArgumentException('rotate must be between 0 and 360');
        }

        $this->rotate = $rotate;
        return $this;
    }

    public function crop(?array $crop): self
    {
        if ($crop !== null) {
            // 验证坐标
            if (isset($crop['x']) && $crop['x'] < 0) {
                throw new InvalidArgumentException('crop x must be >= 0');
            }

            if (isset($crop['y']) && $crop['y'] < 0) {
                throw new InvalidArgumentException('crop y must be >= 0');
            }

            // 验证尺寸
            if (isset($crop['width']) && ($crop['width'] < 1 || $crop['width'] > 30000)) {
                throw new InvalidArgumentException('crop width must be between 1 and 30000');
            }

            if (isset($crop['height']) && ($crop['height'] < 1 || $crop['height'] > 30000)) {
                throw new InvalidArgumentException('crop height must be between 1 and 30000');
            }

            // 验证重心位置
            if (isset($crop['gravity'])) {
                $validGravity = ['nw', 'north', 'ne', 'west', 'center', 'east', 'sw', 'south', 'se'];
                if (! in_array($crop['gravity'], $validGravity, true)) {
                    throw new InvalidArgumentException('crop gravity must be one of: ' . implode(', ', $validGravity));
                }
            }
        }

        $this->crop = $crop;
        return $this;
    }

    public function circle(?int $circle): self
    {
        if ($circle !== null && ($circle < 1 || $circle > 4096)) {
            throw new InvalidArgumentException('circle radius must be between 1 and 4096');
        }

        $this->circle = $circle;
        return $this;
    }

    public function indexcrop(?array $indexcrop): self
    {
        if ($indexcrop !== null) {
            // 验证轴
            if (isset($indexcrop['axis']) && ! in_array($indexcrop['axis'], ['x', 'y'], true)) {
                throw new InvalidArgumentException("indexcrop axis must be 'x' or 'y'");
            }

            // 验证长度
            if (isset($indexcrop['length']) && ($indexcrop['length'] < 1 || $indexcrop['length'] > 30000)) {
                throw new InvalidArgumentException('indexcrop length must be between 1 and 30000');
            }

            // 验证索引
            if (isset($indexcrop['index']) && $indexcrop['index'] < 0) {
                throw new InvalidArgumentException('indexcrop index must be >= 0');
            }
        }

        $this->indexcrop = $indexcrop;
        return $this;
    }

    public function roundedCorners(?int $roundedCorners): self
    {
        if ($roundedCorners !== null && ($roundedCorners < 1 || $roundedCorners > 4096)) {
            throw new InvalidArgumentException('roundedCorners radius must be between 1 and 4096');
        }

        $this->roundedCorners = $roundedCorners;
        return $this;
    }

    public function watermark(?array $watermark): self
    {
        if ($watermark !== null) {
            // 验证类型
            if (isset($watermark['type']) && ! in_array($watermark['type'], ['text', 'image'], true)) {
                throw new InvalidArgumentException("watermark type must be 'text' or 'image'");
            }

            // 验证位置
            if (isset($watermark['position'])) {
                $validPositions = ['nw', 'north', 'ne', 'west', 'center', 'east', 'sw', 'south', 'se'];
                if (! in_array($watermark['position'], $validPositions, true)) {
                    throw new InvalidArgumentException('watermark position must be one of: ' . implode(', ', $validPositions));
                }
            }

            // 验证偏移
            if (isset($watermark['x']) && ($watermark['x'] < 0 || $watermark['x'] > 4096)) {
                throw new InvalidArgumentException('watermark x must be between 0 and 4096');
            }

            if (isset($watermark['y']) && ($watermark['y'] < 0 || $watermark['y'] > 4096)) {
                throw new InvalidArgumentException('watermark y must be between 0 and 4096');
            }

            // 验证透明度
            if (isset($watermark['transparency']) && ($watermark['transparency'] < 0 || $watermark['transparency'] > 100)) {
                throw new InvalidArgumentException('watermark transparency must be between 0 and 100');
            }

            // 验证文字水印的字体大小
            if (isset($watermark['size']) && ($watermark['size'] < 1 || $watermark['size'] > 1000)) {
                throw new InvalidArgumentException('watermark text size must be between 1 and 1000');
            }
        }

        $this->watermark = $watermark;
        return $this;
    }

    public function blur(?array $blur): self
    {
        if ($blur !== null) {
            // 验证半径
            if (isset($blur['radius']) && ($blur['radius'] < 1 || $blur['radius'] > 50)) {
                throw new InvalidArgumentException('blur radius must be between 1 and 50');
            }

            // 验证标准差
            if (isset($blur['sigma']) && ($blur['sigma'] < 1 || $blur['sigma'] > 50)) {
                throw new InvalidArgumentException('blur sigma must be between 1 and 50');
            }
        }

        $this->blur = $blur;
        return $this;
    }

    public function sharpen(?int $sharpen): self
    {
        if ($sharpen !== null && ($sharpen < 50 || $sharpen > 399)) {
            throw new InvalidArgumentException('sharpen must be between 50 and 399');
        }

        $this->sharpen = $sharpen;
        return $this;
    }

    public function bright(?int $bright): self
    {
        if ($bright !== null && ($bright < -100 || $bright > 100)) {
            throw new InvalidArgumentException('bright must be between -100 and 100');
        }

        $this->bright = $bright;
        return $this;
    }

    public function contrast(?int $contrast): self
    {
        if ($contrast !== null && ($contrast < -100 || $contrast > 100)) {
            throw new InvalidArgumentException('contrast must be between -100 and 100');
        }

        $this->contrast = $contrast;
        return $this;
    }

    public function info(bool $info = true): self
    {
        $this->info = $info;
        return $this;
    }

    public function averageHue(bool $averageHue = true): self
    {
        $this->averageHue = $averageHue;
        return $this;
    }

    public function autoOrient(?int $autoOrient): self
    {
        if ($autoOrient !== null && ! in_array($autoOrient, [0, 1], true)) {
            throw new InvalidArgumentException('autoOrient must be 0 or 1');
        }

        $this->autoOrient = $autoOrient;
        return $this;
    }

    public function interlace(?int $interlace): self
    {
        if ($interlace !== null && ! in_array($interlace, [0, 1], true)) {
            throw new InvalidArgumentException('interlace must be 0 or 1');
        }

        $this->interlace = $interlace;
        return $this;
    }

    public function raw(?string $raw): self
    {
        $this->raw = $raw;
        return $this;
    }

    // ========== 获取方法 ==========

    public function getResize(): ?array
    {
        return $this->resize;
    }

    public function getQuality(): ?int
    {
        return $this->quality;
    }

    public function getFormat(): ?string
    {
        return $this->format;
    }

    public function getRotate(): ?int
    {
        return $this->rotate;
    }

    public function getCrop(): ?array
    {
        return $this->crop;
    }

    public function getCircle(): ?int
    {
        return $this->circle;
    }

    public function getIndexcrop(): ?array
    {
        return $this->indexcrop;
    }

    public function getRoundedCorners(): ?int
    {
        return $this->roundedCorners;
    }

    public function getWatermark(): ?array
    {
        return $this->watermark;
    }

    public function getBlur(): ?array
    {
        return $this->blur;
    }

    public function getSharpen(): ?int
    {
        return $this->sharpen;
    }

    public function getBright(): ?int
    {
        return $this->bright;
    }

    public function getContrast(): ?int
    {
        return $this->contrast;
    }

    public function getInfo(): bool
    {
        return $this->info;
    }

    public function getAverageHue(): bool
    {
        return $this->averageHue;
    }

    public function getAutoOrient(): ?int
    {
        return $this->autoOrient;
    }

    public function getInterlace(): ?int
    {
        return $this->interlace;
    }

    public function getRaw(): ?string
    {
        return $this->raw;
    }

    // ========== 数组转换 ==========

    public function toArray(): array
    {
        return array_filter([
            'resize' => $this->resize,
            'quality' => $this->quality,
            'format' => $this->format,
            'rotate' => $this->rotate,
            'crop' => $this->crop,
            'circle' => $this->circle,
            'watermark' => $this->watermark,
            'blur' => $this->blur,
            'sharpen' => $this->sharpen,
            'bright' => $this->bright,
            'contrast' => $this->contrast,
            'indexcrop' => $this->indexcrop,
            'roundedCorners' => $this->roundedCorners,
            'info' => $this->info,
            'averageHue' => $this->averageHue,
            'autoOrient' => $this->autoOrient,
            'interlace' => $this->interlace,
            'raw' => $this->raw,
        ], fn ($value) => $value !== null && $value !== false);
    }

    // ========== 字符串转换 ==========

    /**
     * Create ImageProcessOptions from URL query string.
     * Format: resize=w:300,h:200,m:lfit&quality=90&format=webp.
     *
     * @param string $queryString URL query string containing image process options
     * @throws InvalidArgumentException if query string is invalid or contains invalid parameters
     */
    public static function fromString(string $queryString): self
    {
        $options = new self();

        // Parse query string
        parse_str($queryString, $params);

        if (empty($params)) {
            return $options;
        }

        // Parse each parameter
        foreach ($params as $key => $value) {
            switch ($key) {
                case 'resize':
                    $options->resize(self::parseObjectParam($value, [
                        'w' => 'width',
                        'h' => 'height',
                        'm' => 'mode',
                        'l' => 'limit',
                        's' => 'short',
                        'p' => 'percentage',
                    ]));
                    break;
                case 'quality':
                    $options->quality((int) $value);
                    break;
                case 'format':
                    $options->format((string) $value);
                    break;
                case 'rotate':
                    $options->rotate((int) $value);
                    break;
                case 'crop':
                    $options->crop(self::parseObjectParam($value, [
                        'x' => 'x',
                        'y' => 'y',
                        'w' => 'width',
                        'h' => 'height',
                        'g' => 'gravity',
                    ]));
                    break;
                case 'circle':
                    $options->circle((int) $value);
                    break;
                case 'roundedCorners':
                    $options->roundedCorners((int) $value);
                    break;
                case 'indexcrop':
                    $options->indexcrop(self::parseObjectParam($value, [
                        'a' => 'axis',
                        'l' => 'length',
                        'i' => 'index',
                    ]));
                    break;
                case 'watermark':
                    $options->watermark(self::parseObjectParam($value, [
                        't' => 'type',
                        'c' => 'content',
                        'p' => 'position',
                        'x' => 'x',
                        'y' => 'y',
                        'tr' => 'transparency',
                        's' => 'size',
                        'co' => 'color',
                        'f' => 'font',
                    ]));
                    break;
                case 'blur':
                    $options->blur(self::parseObjectParam($value, [
                        'r' => 'radius',
                        's' => 'sigma',
                    ]));
                    break;
                case 'sharpen':
                    $options->sharpen((int) $value);
                    break;
                case 'bright':
                    $options->bright((int) $value);
                    break;
                case 'contrast':
                    $options->contrast((int) $value);
                    break;
                case 'info':
                    $options->info((bool) $value);
                    break;
                case 'averageHue':
                    $options->averageHue((bool) $value);
                    break;
                case 'autoOrient':
                    $options->autoOrient((int) $value);
                    break;
                case 'interlace':
                    $options->interlace((int) $value);
                    break;
                case 'raw':
                    $options->raw((string) $value);
                    break;
            }
        }

        return $options;
    }

    /**
     * Convert ImageProcessOptions to URL query string.
     */
    public function toString(): string
    {
        $parts = [];

        if ($this->resize !== null) {
            $parts[] = 'resize=' . self::buildObjectParam($this->resize, [
                'width' => 'w',
                'height' => 'h',
                'mode' => 'm',
                'limit' => 'l',
                'short' => 's',
                'percentage' => 'p',
            ]);
        }

        if ($this->quality !== null) {
            $parts[] = 'quality=' . $this->quality;
        }

        if ($this->format !== null) {
            $parts[] = 'format=' . $this->format;
        }

        if ($this->rotate !== null) {
            $parts[] = 'rotate=' . $this->rotate;
        }

        if ($this->crop !== null) {
            $parts[] = 'crop=' . self::buildObjectParam($this->crop, [
                'x' => 'x',
                'y' => 'y',
                'width' => 'w',
                'height' => 'h',
                'gravity' => 'g',
            ]);
        }

        if ($this->circle !== null) {
            $parts[] = 'circle=' . $this->circle;
        }

        if ($this->roundedCorners !== null) {
            $parts[] = 'roundedCorners=' . $this->roundedCorners;
        }

        if ($this->indexcrop !== null) {
            $parts[] = 'indexcrop=' . self::buildObjectParam($this->indexcrop, [
                'axis' => 'a',
                'length' => 'l',
                'index' => 'i',
            ]);
        }

        if ($this->watermark !== null) {
            $parts[] = 'watermark=' . self::buildObjectParam($this->watermark, [
                'type' => 't',
                'content' => 'c',
                'position' => 'p',
                'x' => 'x',
                'y' => 'y',
                'transparency' => 'tr',
                'size' => 's',
                'color' => 'co',
                'font' => 'f',
            ]);
        }

        if ($this->blur !== null) {
            $parts[] = 'blur=' . self::buildObjectParam($this->blur, [
                'radius' => 'r',
                'sigma' => 's',
            ]);
        }

        if ($this->sharpen !== null) {
            $parts[] = 'sharpen=' . $this->sharpen;
        }

        if ($this->bright !== null) {
            $parts[] = 'bright=' . $this->bright;
        }

        if ($this->contrast !== null) {
            $parts[] = 'contrast=' . $this->contrast;
        }

        if ($this->info) {
            $parts[] = 'info=1';
        }

        if ($this->averageHue) {
            $parts[] = 'averageHue=1';
        }

        if ($this->autoOrient !== null) {
            $parts[] = 'autoOrient=' . $this->autoOrient;
        }

        if ($this->interlace !== null) {
            $parts[] = 'interlace=' . $this->interlace;
        }

        if ($this->raw !== null) {
            $parts[] = 'raw=' . urlencode($this->raw);
        }

        return implode('&', $parts);
    }

    /**
     * Parse object parameter from string format.
     * Format: key1:value1,key2:value2.
     *
     * @param string $value Parameter value
     * @param array $mapping Short key to full key mapping
     */
    private static function parseObjectParam(string $value, array $mapping): array
    {
        $result = [];
        $pairs = explode(',', $value);

        foreach ($pairs as $pair) {
            $parts = explode(':', $pair, 2);
            if (count($parts) === 2) {
                [$shortKey, $val] = $parts;
                $fullKey = $mapping[$shortKey] ?? $shortKey;

                // URL decode value
                $val = urldecode($val);

                // Convert numeric strings to integers
                if (is_numeric($val)) {
                    $val = strpos($val, '.') !== false ? (float) $val : (int) $val;
                }

                $result[$fullKey] = $val;
            }
        }

        return $result;
    }

    /**
     * Build object parameter to string format.
     * Format: key1:value1,key2:value2.
     *
     * @param array $data Parameter data
     * @param array $mapping Full key to short key mapping
     */
    private static function buildObjectParam(array $data, array $mapping): string
    {
        $pairs = [];

        foreach ($data as $fullKey => $value) {
            $shortKey = $mapping[$fullKey] ?? $fullKey;
            // URL encode value if it contains special characters
            if (is_string($value) && preg_match('/[^a-zA-Z0-9._-]/', $value)) {
                $value = urlencode($value);
            }
            $pairs[] = "{$shortKey}:{$value}";
        }

        return implode(',', $pairs);
    }
}
