#!/usr/bin/env python3
"""
工作目录扫描性能测试脚本

用于验证线上环境中 MagicAgent._prepare_prompt_variables 方法的目录扫描性能问题。
可以直接在线上环境运行，无需修改源码。

使用方法:
python scripts/performance_test_workspace_scan.py
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

# 添加项目根目录到 Python 路径
script_dir = Path(__file__).parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))

def format_size(size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}TB"

def format_time(seconds: float) -> str:
    """格式化时间"""
    if seconds < 1:
        return f"{seconds*1000:.1f}ms"
    elif seconds < 60:
        return f"{seconds:.2f}s"
    else:
        minutes = int(seconds // 60)
        remaining_seconds = seconds % 60
        return f"{minutes}m{remaining_seconds:.1f}s"

def is_text_file(file_path: Path) -> bool:
    """判断文件是否为文本/代码文件（简化版）"""
    text_extensions = {
        '.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml',
        '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.sh', '.bat', '.ps1',
        '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs',
        '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.r', '.m', '.scala', '.kt'
    }

    try:
        suffix = file_path.suffix.lower()
        if suffix in text_extensions:
            return True

        # 检查文件名（无扩展名的文件）
        name = file_path.name.lower()
        if name in {'readme', 'license', 'dockerfile', 'makefile', 'changelog', 'todo'}:
            return True

        return False
    except:
        return False

def scan_directory_recursive(
    current_path: Path,
    current_level: int,
    max_level: int = 1,
    filter_binary: bool = True,
    stats: Dict = None
) -> Tuple[List[str], Dict]:
    """递归扫描目录（模拟 ListDir 工具的核心逻辑）"""

    if stats is None:
        stats = {
            'total_items': 0,
            'filtered_items': 0,
            'total_files': 0,
            'total_dirs': 0,
            'total_size': 0,
            'scan_times': [],
            'errors': []
        }

    output_lines = []

    # 检查深度限制
    if current_level > max_level:
        return output_lines, stats

    # 获取目录项目
    try:
        scan_start = time.time()
        items = list(current_path.iterdir())
        scan_time = time.time() - scan_start
        stats['scan_times'].append(scan_time)

        # 排序：目录在前，按名称排序
        items = sorted(items, key=lambda x: (not x.is_dir(), x.name.lower()))

    except PermissionError as e:
        stats['errors'].append(f"Permission denied: {current_path}")
        return [f"[ERROR] Permission denied: {current_path}"], stats
    except Exception as e:
        stats['errors'].append(f"Cannot access {current_path}: {e}")
        return [f"[ERROR] Cannot access: {current_path} - {e}"], stats

    # 过滤隐藏文件
    items = [item for item in items if not item.name.startswith('.')]

    # 过滤二进制文件
    if filter_binary:
        original_count = len(items)
        items = [item for item in items if item.is_dir() or is_text_file(item)]
        stats['filtered_items'] += original_count - len(items)

    # 处理每个项目
    for idx, item in enumerate(items):
        stats['total_items'] += 1

        if item.is_dir():
            stats['total_dirs'] += 1
            # 计算子项目数量
            try:
                sub_items = list(item.iterdir())
                sub_items = [si for si in sub_items if not si.name.startswith('.')]
                if filter_binary:
                    sub_items = [sub_item for sub_item in sub_items
                               if sub_item.is_dir() or is_text_file(sub_item)]
                item_count = len(sub_items)
                count_str = f"{item_count} items"
            except:
                count_str = "? items"

            output_lines.append(f"[DIR] {item.name}/ ({count_str})")

            # 递归处理子目录
            if current_level < max_level:
                sub_lines, stats = scan_directory_recursive(
                    item, current_level + 1, max_level, filter_binary, stats
                )
                output_lines.extend(sub_lines)

        else:
            stats['total_files'] += 1
            # 处理文件
            try:
                file_size = item.stat().st_size
                stats['total_size'] += file_size
                size_str = format_size(file_size)
                output_lines.append(f"[FILE] {item.name} ({size_str})")
            except Exception as e:
                stats['errors'].append(f"Cannot stat {item}: {e}")
                output_lines.append(f"[FILE] {item.name} (ERROR: {e})")

    return output_lines, stats

def detect_s3_mount(path: Path) -> Dict[str, any]:
    """检测是否为S3挂载文件系统"""
    mount_info = {
        'is_s3_mount': False,
        'mount_type': 'unknown',
        'mount_point': None,
        'details': []
    }

    try:
        import subprocess
        # 检查挂载信息
        result = subprocess.run(['mount'], capture_output=True, text=True, timeout=5)
        mount_lines = result.stdout.split('\n')

        path_str = str(path.resolve())

        for line in mount_lines:
            if any(s3_indicator in line.lower() for s3_indicator in ['s3fs', 'goofys', 's3ql', 'rclone']):
                if path_str.startswith(line.split()[2]) if len(line.split()) >= 3 else False:
                    mount_info['is_s3_mount'] = True
                    mount_info['mount_point'] = line.split()[2] if len(line.split()) >= 3 else None
                    if 's3fs' in line.lower():
                        mount_info['mount_type'] = 's3fs'
                    elif 'goofys' in line.lower():
                        mount_info['mount_type'] = 'goofys'
                    elif 'rclone' in line.lower():
                        mount_info['mount_type'] = 'rclone'
                    mount_info['details'].append(line.strip())
                    break

        # 检查文件系统类型
        result = subprocess.run(['df', '-T', str(path)], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                fs_type = lines[1].split()[1] if len(lines[1].split()) >= 2 else 'unknown'
                mount_info['details'].append(f"Filesystem type: {fs_type}")
                if fs_type in ['fuse.s3fs', 'fuse.goofys', 'fuse.rclone']:
                    mount_info['is_s3_mount'] = True
                    mount_info['mount_type'] = fs_type.replace('fuse.', '')

    except Exception as e:
        mount_info['details'].append(f"Detection error: {e}")

    return mount_info

def test_workspace_scan_performance():
    """测试工作目录扫描性能"""

    print("🔍 工作目录扫描性能测试")
    print("=" * 50)

    # 获取工作目录路径
    try:
        from app.path_manager import PathManager
        workspace_dir = PathManager.get_workspace_dir()
    except Exception as e:
        print(f"❌ 无法获取工作目录路径: {e}")
        # 回退方案
        workspace_dir = Path(os.getcwd()) / ".workspace"

    print(f"📂 扫描目录: {workspace_dir}")
    print(f"📁 目录存在: {'✅' if workspace_dir.exists() else '❌'}")

    # 检测S3挂载
    s3_info = detect_s3_mount(workspace_dir)
    if s3_info['is_s3_mount']:
        print(f"🌐 检测到S3挂载: ✅ ({s3_info['mount_type']})")
        print(f"📍 挂载点: {s3_info['mount_point']}")
        print("⚠️  S3挂载文件系统性能警告:")
        print("    - 每次目录操作都是网络请求")
        print("    - 预期性能比本地文件系统慢100-1000倍")
        print("    - 大量文件扫描可能需要几分钟")
        for detail in s3_info['details']:
            print(f"    📋 {detail}")
    else:
        print("💾 本地文件系统: ✅")

    if not workspace_dir.exists():
        print("⚠️  工作目录不存在，无法进行测试")
        return

    # 快速统计目录信息
    print("\n📊 目录基本信息:")
    try:
        dir_scan_start = time.time()

        # 统计总文件和目录数
        total_files = 0
        total_dirs = 0
        total_size = 0

        for root, dirs, files in os.walk(workspace_dir):
            total_dirs += len(dirs)
            total_files += len(files)
            for file in files:
                try:
                    file_path = Path(root) / file
                    total_size += file_path.stat().st_size
                except:
                    pass

        dir_scan_time = time.time() - dir_scan_start

        print(f"   总文件数: {total_files:,}")
        print(f"   总目录数: {total_dirs:,}")
        print(f"   总大小: {format_size(total_size)}")
        print(f"   统计耗时: {format_time(dir_scan_time)}")

    except Exception as e:
        print(f"   ❌ 统计失败: {e}")

    # 根据是否S3挂载调整测试配置
    if s3_info['is_s3_mount']:
        print("\n🌐 S3挂载环境 - 使用保守测试配置")
        test_configs = [
            {"level": 1, "filter_binary": True, "name": "Level 1 + 过滤二进制（推荐）"},
            {"level": 2, "filter_binary": True, "name": "Level 2 + 过滤二进制"},
            {"level": 3, "filter_binary": True, "name": "Level 3 + 过滤二进制（谨慎）"},
            {"level": 5, "filter_binary": True, "name": "Level 5 + 过滤二进制（当前默认-危险）"},
        ]
        print("⚠️  跳过 Level 5 不过滤二进制测试（可能耗时过长）")
    else:
        test_configs = [
            {"level": 1, "filter_binary": True, "name": "Level 1 + 过滤二进制"},
            {"level": 2, "filter_binary": True, "name": "Level 2 + 过滤二进制"},
            {"level": 3, "filter_binary": True, "name": "Level 3 + 过滤二进制"},
            {"level": 5, "filter_binary": True, "name": "Level 5 + 过滤二进制（当前默认）"},
            {"level": 5, "filter_binary": False, "name": "Level 5 + 不过滤二进制"},
        ]

    print("\n🧪 性能测试结果:")
    print("-" * 80)
    print(f"{'配置':<35} {'耗时':<12} {'文件':<8} {'目录':<8} {'过滤':<8} {'错误':<8}")
    print("-" * 80)

    for config in test_configs:
        try:
            print(f"\n⏱️  开始测试: {config['name']}")

            # 对于S3挂载，添加超时保护
            import signal
            def timeout_handler(signum, frame):
                raise TimeoutError("扫描超时")

            timeout_seconds = 300 if s3_info['is_s3_mount'] else 60  # S3环境5分钟超时
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout_seconds)

            try:
                # 执行扫描测试
                start_time = time.time()

                output_lines, stats = scan_directory_recursive(
                    workspace_dir,
                    current_level=1,
                    max_level=config["level"],
                    filter_binary=config["filter_binary"]
                )

                end_time = time.time()
                duration = end_time - start_time

                # 取消超时
                signal.alarm(0)

                # 输出结果
                print(f"{config['name']:<35} {format_time(duration):<12} "
                      f"{stats['total_files']:<8} {stats['total_dirs']:<8} "
                      f"{stats['filtered_items']:<8} {len(stats['errors']):<8}")

                # S3环境的性能警告阈值更低
                warning_threshold = 10.0 if s3_info['is_s3_mount'] else 5.0
                critical_threshold = 60.0 if s3_info['is_s3_mount'] else 30.0

                if duration > critical_threshold:
                    print(f"   🚨 CRITICAL: 扫描耗时过长 ({format_time(duration)})！严重影响用户体验")
                elif duration > warning_threshold:
                    print(f"   ⚠️  WARNING: 扫描耗时较长 ({format_time(duration)})，建议优化")

                if stats['scan_times'] and duration > warning_threshold:
                    avg_scan_time = sum(stats['scan_times']) / len(stats['scan_times'])
                    max_scan_time = max(stats['scan_times'])
                    print(f"   📈 平均单次目录扫描: {format_time(avg_scan_time)}")
                    print(f"   📈 最慢单次目录扫描: {format_time(max_scan_time)}")

                    if s3_info['is_s3_mount']:
                        total_api_calls = len(stats['scan_times']) + stats['total_files']
                        print(f"   🌐 估计S3 API调用次数: {total_api_calls:,}")
                        print(f"   💰 估计API成本 (假设$0.0004/1000次): ${total_api_calls * 0.0004 / 1000:.4f}")

            except TimeoutError:
                signal.alarm(0)
                print(f"{config['name']:<35} {'TIMEOUT':<12} - 扫描超时 ({timeout_seconds}s)")
                print(f"   🚨 扫描在{timeout_seconds}秒内未完成，跳过后续更深层级的测试")
                break

        except Exception as e:
            signal.alarm(0)  # 确保取消超时
            print(f"{config['name']:<35} {'ERROR':<12} - {e}")

    print("-" * 80)

    # 模拟真实的 MagicAgent 调用
    print("\n🎯 模拟 MagicAgent._prepare_prompt_variables 调用:")
    try:
        # 这是实际代码中的调用方式
        from app.tools.list_dir import ListDir

        start_time = time.time()

        list_dir_tool = ListDir()
        # 使用新的公共接口获取文件树字符串
        result = list_dir_tool.get_file_tree_string(
            relative_workspace_path=".",
            level=5,
            filter_binary=False
        )

        end_time = time.time()
        duration = end_time - start_time

        print(f"   ⏱️ 实际调用耗时: {format_time(duration)}")
        print(f"   📝 结果长度: {len(result):,} 字符")

        if duration > 10.0:
            print(f"   🚨 WARNING: 耗时过长！严重影响用户体验")
        elif duration > 3.0:
            print(f"   ⚠️ WARNING: 耗时较长，建议优化")
        else:
            print(f"   ✅ 性能正常")

        # 显示结果预览
        preview = result[:500] + "..." if len(result) > 500 else result
        print(f"   📄 结果预览:\n{preview}")

    except Exception as e:
        print(f"   ❌ 模拟调用失败: {e}")

    # S3挂载环境的特殊建议
    if s3_info['is_s3_mount']:
        print("\n" + "=" * 50)
        print("🌐 S3挂载环境优化建议")
        print("=" * 50)
        print("🚨 紧急优化（立即执行）:")
        print("   1. 降低扫描深度: level=5 → level=1 或 level=2")
        print("   2. 启用二进制过滤: filter_binary=True")
        print("   3. 添加缓存机制: 避免重复扫描相同目录")

        print("\n⚡ 短期优化 (1-2周内):")
        print("   1. 条件扫描: 只在必要时进行目录扫描")
        print("   2. 异步扫描: 在后台异步获取目录结构")
        print("   3. 分页扫描: 分批次获取目录内容")

        print("\n🏗️ 长期优化 (1个月内):")
        print("   1. 目录索引: 维护目录结构索引/缓存")
        print("   2. 配置开关: 允许用户禁用目录扫描")
        print("   3. 智能缓存: 基于目录修改时间的缓存策略")
        print("   4. CDN缓存: 使用CloudFront缓存S3目录列表")

        print("\n💰 成本优化:")
        print("   1. 使用S3 List Objects v2 API (更便宜)")
        print("   2. 缓存目录列表 (减少API调用)")
        print("   3. 设置合理的缓存TTL (如5-10分钟)")

        print("\nS3挂载工具对比:")
        print("   📊 s3fs:    兼容性好，性能一般")
        print("   🚀 goofys:  性能更好，适合大文件")
        print("   ⚡ rclone:  功能丰富，缓存能力强")
        print("   💡 建议:    考虑切换到goofys或rclone提升性能")

    print("\n" + "=" * 50)
    print("✅ 性能测试完成")

def main():
    """主函数"""
    try:
        test_workspace_scan_performance()
    except KeyboardInterrupt:
        print("\n⚠️ 测试被用户中断")
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
