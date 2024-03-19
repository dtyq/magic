#!/usr/bin/env python3
"""
测试网络文件系统的 mtime 更新延迟问题
模拟 edit_file 工具的时间戳管理逻辑
"""

import os
import time
from pathlib import Path
import json

def test_mtime_delay():
    """测试文件 mtime 更新是否有延迟"""

    test_file = "test_mtime_file.txt"
    timestamp_file = "test_timestamps.json"

    print("=" * 60)
    print("测试网络文件系统 mtime 更新延迟")
    print("=" * 60)

    # 清理旧文件
    for f in [test_file, timestamp_file]:
        if os.path.exists(f):
            os.remove(f)
            print(f"已删除旧文件: {f}")

    # 步骤1: 创建并写入初始内容（模拟 write_file）
    print("\n步骤1: 创建文件并写入初始内容")
    with open(test_file, 'w') as f:
        f.write("Initial content\n")

    # 获取写入后的 mtime
    mtime1 = os.path.getmtime(test_file) * 1000
    print(f"文件创建后 mtime: {mtime1:.3f} ms")

    # 保存时间戳（模拟 timestamp_manager.set_timestamp）
    timestamps = {test_file: mtime1}
    with open(timestamp_file, 'w') as f:
        json.dump(timestamps, f)
    print(f"保存时间戳到管理器: {mtime1:.3f} ms")

    # 短暂等待
    time.sleep(0.1)
    print("\n等待 0.1 秒...")

    # 步骤2: 第一次编辑（模拟 edit_file）
    print("\n步骤2: 第一次编辑文件")

    # 编辑前验证时间戳
    current_mtime = os.path.getmtime(test_file) * 1000
    saved_timestamp = timestamps[test_file]
    print(f"编辑前 - 当前 mtime: {current_mtime:.3f} ms")
    print(f"编辑前 - 保存的时间戳: {saved_timestamp:.3f} ms")

    if current_mtime > saved_timestamp:
        print("❌ 验证失败: 文件已被修改")
    else:
        print("✅ 验证通过: 可以编辑")

    # 执行编辑
    with open(test_file, 'w') as f:
        f.write("First edit content\n")
    print("已写入新内容")

    # 立即获取 mtime（模拟 update_timestamp_after_write）
    mtime2_immediate = os.path.getmtime(test_file) * 1000
    print(f"编辑后立即获取的 mtime: {mtime2_immediate:.3f} ms")

    # 更新时间戳
    timestamps[test_file] = mtime2_immediate
    print(f"更新时间戳为: {mtime2_immediate:.3f} ms")

    # 检查多次 mtime 变化
    print("\n监测 mtime 变化（每0.05秒检查一次，共10次）:")
    for i in range(10):
        time.sleep(0.05)
        current = os.path.getmtime(test_file) * 1000
        diff = current - mtime2_immediate
        if diff != 0:
            print(f"  [{i+1}] mtime: {current:.3f} ms (差异: +{diff:.3f} ms) ⚠️ 变化了！")
        else:
            print(f"  [{i+1}] mtime: {current:.3f} ms (差异: {diff:.3f} ms)")

    # 步骤3: 立即尝试第二次编辑（模拟连续编辑）
    print("\n步骤3: 立即尝试第二次编辑")

    # 编辑前验证时间戳
    current_mtime = os.path.getmtime(test_file) * 1000
    saved_timestamp = timestamps[test_file]
    print(f"第二次编辑前 - 当前 mtime: {current_mtime:.3f} ms")
    print(f"第二次编辑前 - 保存的时间戳: {saved_timestamp:.3f} ms")
    print(f"差异: {current_mtime - saved_timestamp:.3f} ms")

    if current_mtime > saved_timestamp:
        print("❌ 验证失败: 文件已被修改（mtime 发生了延迟更新！）")
        print(f"   这解释了为什么连续编辑会报错")
    else:
        print("✅ 验证通过: 可以编辑")

    # 步骤4: 测试不同时间间隔
    print("\n步骤4: 测试不同等待时间后的 mtime 稳定性")

    wait_times = [0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0]

    for wait_time in wait_times:
        # 写入文件
        with open(test_file, 'w') as f:
            f.write(f"Test content {wait_time}\n")

        # 立即获取 mtime
        mtime_immediate = os.path.getmtime(test_file) * 1000

        # 等待
        if wait_time > 0:
            time.sleep(wait_time)

        # 再次获取 mtime
        mtime_after = os.path.getmtime(test_file) * 1000

        diff = mtime_after - mtime_immediate
        status = "✅" if diff == 0 else "⚠️"
        print(f"  等待 {wait_time:4.2f}s: mtime 差异 = {diff:6.3f} ms {status}")

    print("\n" + "=" * 60)
    print("测试结论:")
    print("如果看到 mtime 差异不为0，说明网络文件系统存在 mtime 更新延迟")
    print("这会导致 edit_file 工具在连续编辑时误判文件已被修改")
    print("=" * 60)

    # 清理测试文件
    for f in [test_file, timestamp_file]:
        if os.path.exists(f):
            os.remove(f)

if __name__ == "__main__":
    test_mtime_delay()
