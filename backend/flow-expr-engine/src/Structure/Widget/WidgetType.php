<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget;

enum WidgetType: string
{
    /**
     * 根节点.
     */
    case Root = 'root';

    /**
     * 单行输入框.
     */
    case Input = 'input';

    /**
     * 表达式输入框.
     */
    case Expression = 'expression';

    /**
     * 密码输入框.
     */
    case Password = 'input-password';

    /**
     * 下拉选择器.
     */
    case Select = 'select';

    /**
     * 数字输入框.
     */
    case Number = 'input-number';

    /**
     * 开关.
     */
    case Switch = 'switch';

    /**
     * 数组 - 值在本身的value.
     */
    case Array = 'array';

    /**
     * 对象 - 值在子集的containerFields里面.
     */
    case Object = 'object';

    /**
     * 联动.
     */
    case Linkage = 'linkage';

    /**
     * 文本域.
     */
    case Textarea = 'textarea';

    /**
     * 人员.
     */
    case Member = 'member';

    /**
     * 日期选择器.
     */
    case TimePicker = 'time-picker';

    /**
     * 附件.
     */
    case Files = 'files';

    /**
     * 勾选.
     */
    case Checkbox = 'checkbox';

    public static function make(int|string|null $input = null): ?self
    {
        // 兼容一下旧的
        if ($input === 'password') {
            return self::Password;
        }
        if ($input === 'number') {
            return self::Number;
        }
        return self::tryFrom($input ?? '');
    }

    public function isDesensitization(): bool
    {
        return $this === self::Password;
    }
}
