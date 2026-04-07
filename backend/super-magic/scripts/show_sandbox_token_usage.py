"""
显示 sandbox 维度的 token 使用情况

用法:
    python scripts/show_sandbox_token_usage.py [sandbox_id]

如果不指定 sandbox_id，将显示默认的 default_sandbox 的使用情况。
"""

import os
import sys
import json
from pathlib import Path

def get_project_root() -> Path:
    """获取项目根目录的路径"""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent

# 项目根目录
PROJECT_ROOT = get_project_root()
from app.path_manager import PathManager
# 初始化 PathManager
PathManager.set_project_root(PROJECT_ROOT)

def main():
    # 从命令行参数获取 sandbox_id，如果未提供则使用默认值
    sandbox_id = sys.argv[1] if len(sys.argv) > 1 else "default_sandbox"

    # 构建报告文件路径
    report_path = os.path.join(PathManager.get_chat_history_dir(), f"{sandbox_id}_token_usage.json")

    # 检查文件是否存在
    if not os.path.exists(report_path):
        print(f"错误: 找不到 sandbox '{sandbox_id}' 的 token 使用报告文件")
        print(f"预期路径: {report_path}")
        return 1

    # 读取报告
    try:
        with open(report_path, 'r', encoding='utf-8') as f:
            report = json.load(f)

        # 显示报告基本信息
        print(f"===== Sandbox '{sandbox_id}' Token 使用情况 =====")
        print(f"报告生成时间: {report.get('timestamp', '未知')}")
        print(f"货币单位: {report['currency']['symbol']} ({report['currency']['code']})")
        print("-" * 70)

        # 显示每个模型的使用情况
        print("模型用量明细:")
        for model in report.get('models', []):
            print(f"  模型: {model['model_name']}")
            print(f"    输入tokens: {model['input_tokens']:,}")
            print(f"    输出tokens: {model['output_tokens']:,}")

            # 显示缓存相关信息（如果有）
            # 兼容新旧字段名
            cached_tokens = model.get('cached_tokens') or model.get('cache_hit_tokens')
            if cached_tokens:
                print(f"    缓存命中tokens: {cached_tokens:,}")
            if 'cache_write_tokens' in model:
                print(f"    缓存写入tokens: {model['cache_write_tokens']:,}")

            print(f"    总tokens: {model['total_tokens']:,}")
            print(f"    估算成本: {report['currency']['symbol']}{model['cost']:.6f}")
            print(f"    原始货币: {model.get('original_currency', report['currency']['code'])}")
            print("  " + "-" * 40)

        # 显示总计
        total = report.get('total', {})
        print("\n总计:")
        print(f"  总输入tokens: {total.get('input_tokens', 0):,}")
        print(f"  总输出tokens: {total.get('output_tokens', 0):,}")

        if 'cached_tokens' in total and total['cached_tokens'] > 0:
            print(f"  总缓存tokens: {total['cached_tokens']:,}")

        print(f"  所有tokens总计: {total.get('total_tokens', 0):,}")
        print(f"  总估算成本: {report['currency']['symbol']}{total.get('cost', 0):.6f}")

        return 0
    except json.JSONDecodeError:
        print(f"错误: 无法解析报告文件 {report_path}")
        return 1
    except Exception as e:
        print(f"错误: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
