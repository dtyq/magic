<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\OSS;

use Dtyq\CloudFile\Kernel\Driver\ImageProcessInterface;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;

/**
 * 阿里云 OSS 图片处理器
 * 将统一的 ImageProcessOptions 转换为 OSS 特定的处理字符串.
 *
 * @see https://help.aliyun.com/zh/oss/user-guide/overview-17/
 */
class OSSImageProcessor implements ImageProcessInterface
{
    /**
     * 从统一选项构建 OSS 特定的处理字符串.
     *
     * @return string OSS 处理字符串（例如：'image/resize,w_300/quality,q_90'）
     */
    public function buildProcessString(ImageProcessOptions $options): string
    {
        // 向下兼容：如果提供了原始字符串，直接使用
        if ($raw = $options->getRaw()) {
            return $raw;
        }

        $operations = [];

        // 缩放: image/resize,m_lfit,w_300,h_200
        if ($resize = $options->getResize()) {
            $operations[] = $this->buildResize($resize);
        }

        // 质量: quality,q_90
        if ($quality = $options->getQuality()) {
            $operations[] = "quality,q_{$quality}";
        }

        // 格式: format,webp
        if ($format = $options->getFormat()) {
            $operations[] = "format,{$format}";
        }

        // 旋转: rotate,90
        if (($rotate = $options->getRotate()) !== null) {
            $operations[] = "rotate,{$rotate}";
        }

        // 裁剪: crop,x_10,y_10,w_100,h_100
        if ($crop = $options->getCrop()) {
            $operations[] = $this->buildCrop($crop);
        }

        // 内切圆: circle,r_100
        if ($circle = $options->getCircle()) {
            $operations[] = "circle,r_{$circle}";
        }

        // 模糊: blur,r_3,s_2
        if ($blur = $options->getBlur()) {
            $operations[] = $this->buildBlur($blur);
        }

        // 亮度: bright,50
        if (($bright = $options->getBright()) !== null) {
            $operations[] = "bright,{$bright}";
        }

        // 对比度: contrast,50
        if (($contrast = $options->getContrast()) !== null) {
            $operations[] = "contrast,{$contrast}";
        }

        // 锐化: sharpen,100
        if ($sharpen = $options->getSharpen()) {
            $operations[] = "sharpen,{$sharpen}";
        }

        // 水印
        if ($watermark = $options->getWatermark()) {
            $operations[] = $this->buildWatermark($watermark);
        }

        // 圆角矩形: rounded-corners,r_30
        if ($roundedCorners = $options->getRoundedCorners()) {
            $operations[] = "rounded-corners,r_{$roundedCorners}";
        }

        // 索引切割: indexcrop,x_100,i_1
        if ($indexcrop = $options->getIndexcrop()) {
            $operations[] = $this->buildIndexcrop($indexcrop);
        }

        // 自适应方向: auto-orient,1
        if (($autoOrient = $options->getAutoOrient()) !== null) {
            $operations[] = "auto-orient,{$autoOrient}";
        }

        // 渐进显示: interlace,1
        if (($interlace = $options->getInterlace()) !== null) {
            $operations[] = "interlace,{$interlace}";
        }

        // 获取信息
        if ($options->getInfo()) {
            $operations[] = 'info';
        }

        // 获取主色调
        if ($options->getAverageHue()) {
            $operations[] = 'average-hue';
        }

        return empty($operations) ? '' : 'image/' . implode('/', $operations);
    }

    /**
     * 获取 OSS 的参数名称.
     */
    public function getParameterName(): string
    {
        return 'x-oss-process';
    }

    /**
     * 构建缩放操作字符串.
     *
     * @param array $config ['width' => 300, 'height' => 200, 'mode' => 'lfit']
     */
    private function buildResize(array $config): string
    {
        $parts = [];

        // 模式: m_lfit（未指定时的默认值）
        if (isset($config['mode'])) {
            $parts[] = "m_{$config['mode']}";
        }

        // 宽度: w_300
        if (isset($config['width'])) {
            $parts[] = "w_{$config['width']}";
        }

        // 高度: h_200
        if (isset($config['height'])) {
            $parts[] = "h_{$config['height']}";
        }

        // 长边限制: l_500
        if (isset($config['limit'])) {
            $parts[] = "l_{$config['limit']}";
        }

        // 短边限制: s_200
        if (isset($config['short'])) {
            $parts[] = "s_{$config['short']}";
        }

        // 百分比缩放: p_50
        if (isset($config['percentage'])) {
            $parts[] = "p_{$config['percentage']}";
        }

        return empty($parts) ? '' : 'resize,' . implode(',', $parts);
    }

    /**
     * 构建裁剪操作字符串.
     *
     * @param array $config ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 100]
     */
    private function buildCrop(array $config): string
    {
        $parts = [];

        if (isset($config['x'])) {
            $parts[] = "x_{$config['x']}";
        }

        if (isset($config['y'])) {
            $parts[] = "y_{$config['y']}";
        }

        if (isset($config['width'])) {
            $parts[] = "w_{$config['width']}";
        }

        if (isset($config['height'])) {
            $parts[] = "h_{$config['height']}";
        }

        // 重心位置: g_nw（用于基于位置的裁剪）
        if (isset($config['gravity'])) {
            $parts[] = "g_{$config['gravity']}";
        }

        return empty($parts) ? '' : 'crop,' . implode(',', $parts);
    }

    /**
     * 构建模糊操作字符串.
     *
     * @param array $config ['radius' => 3, 'sigma' => 2]
     */
    private function buildBlur(array $config): string
    {
        $parts = [];

        // 半径: r_3
        if (isset($config['radius'])) {
            $parts[] = "r_{$config['radius']}";
        }

        // 标准差: s_2
        if (isset($config['sigma'])) {
            $parts[] = "s_{$config['sigma']}";
        }

        return empty($parts) ? '' : 'blur,' . implode(',', $parts);
    }

    /**
     * 构建水印操作字符串.
     *
     * @param array $config ['type' => 'text|image', 'content' => '...', ...]
     */
    private function buildWatermark(array $config): string
    {
        $type = $config['type'] ?? 'text';

        if ($type === 'text') {
            return $this->buildTextWatermark($config);
        }

        return $this->buildImageWatermark($config);
    }

    /**
     * 构建文字水印字符串.
     */
    private function buildTextWatermark(array $config): string
    {
        $parts = [];

        // 文字内容（base64 编码）
        if (isset($config['content'])) {
            $parts[] = 'text_' . base64_encode($config['content']);
        }

        // 字体类型
        if (isset($config['font'])) {
            $parts[] = "type_{$config['font']}";
        }

        // 字体大小
        if (isset($config['size'])) {
            $parts[] = "size_{$config['size']}";
        }

        // 字体颜色
        if (isset($config['color'])) {
            $parts[] = "color_{$config['color']}";
        }

        // 位置
        if (isset($config['position'])) {
            $parts[] = "g_{$config['position']}";
        }

        // X 偏移
        if (isset($config['x'])) {
            $parts[] = "x_{$config['x']}";
        }

        // Y 偏移
        if (isset($config['y'])) {
            $parts[] = "y_{$config['y']}";
        }

        // 透明度 (0-100)
        if (isset($config['transparency'])) {
            $parts[] = "t_{$config['transparency']}";
        }

        return empty($parts) ? '' : 'watermark,' . implode(',', $parts);
    }

    /**
     * 构建图片水印字符串.
     */
    private function buildImageWatermark(array $config): string
    {
        $parts = [];

        // 图片对象键（base64 编码）
        if (isset($config['content'])) {
            $parts[] = 'image_' . base64_encode($config['content']);
        }

        // 位置
        if (isset($config['position'])) {
            $parts[] = "g_{$config['position']}";
        }

        // X 偏移
        if (isset($config['x'])) {
            $parts[] = "x_{$config['x']}";
        }

        // Y 偏移
        if (isset($config['y'])) {
            $parts[] = "y_{$config['y']}";
        }

        // 透明度 (0-100)
        if (isset($config['transparency'])) {
            $parts[] = "t_{$config['transparency']}";
        }

        return empty($parts) ? '' : 'watermark,' . implode(',', $parts);
    }

    /**
     * 构建索引切割字符串.
     *
     * @param array $config ['axis' => 'x'|'y', 'length' => 100, 'index' => 1]
     */
    private function buildIndexcrop(array $config): string
    {
        $parts = [];

        // 轴和长度: x_100 或 y_100
        if (isset($config['axis'], $config['length'])) {
            $parts[] = "{$config['axis']}_{$config['length']}";
        }

        // 索引: i_1
        if (isset($config['index'])) {
            $parts[] = "i_{$config['index']}";
        }

        return empty($parts) ? '' : 'indexcrop,' . implode(',', $parts);
    }
}
