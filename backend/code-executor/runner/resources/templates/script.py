import resource
import json
from io import StringIO
import contextlib
import warnings


def sanitize_globals():
    dangerous = ['eval', 'exec', 'compile', 'open', '__import__', 'exit', 'quit']
    for name in dangerous:
        globals().pop(name, None)

sanitize_globals()

__args__ = json.loads(input())
if __args__:
    locals().update(__args__)

def print_err(*args):
    import sys
    sys.stderr.write(' '.join(map(str, args)))
    exit(1)

warnings.filterwarnings("ignore")

def main():
%{code}%

result = None

output = StringIO()
result = None
with contextlib.redirect_stdout(output):
    try:
        result = main()
    except MemoryError:
        print_err("Memory limit exceeded")
    except Exception as e:
        print_err(f"Error: {{str(e)}}")

import sys
sys.stdout.write(json.dumps({"result": result, "output": output.getvalue()}))
