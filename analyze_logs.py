import json
from collections import Counter, defaultdict
from datetime import datetime

def analyze_logs(file_path):
    try:
        with open(file_path, 'r') as f:
            logs = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    errors = []
    warnings = []
    status_codes = Counter()
    error_details = defaultdict(list)

    for log in logs:
        status = log.get('responseStatusCode', 0)
        level = log.get('level', 'info')
        path = log.get('requestPath', 'unknown')
        method = log.get('requestMethod', 'unknown')
        time = log.get('TimeUTC', 'unknown')
        message = log.get('message', '')
        
        status_codes[status] += 1

        if level == 'error' or (isinstance(status, int) and status >= 500):
            errors.append(log)
            key = f"{method} {path} ({status})"
            error_details[key].append(f"{time}: {message}")
        elif level == 'warning' or (isinstance(status, int) and status >= 400):
            warnings.append(log)
            key = f"{method} {path} ({status})"
            error_details[key].append(f"{time}: {message}")

    print(f"Total Logs: {len(logs)}")
    print("-" * 20)
    print("Status Code Distribution:")
    for code, count in status_codes.most_common():
        print(f"  {code}: {count}")
    
    print("-" * 20)
    print(f"Total Errors (5xx or level='error'): {len(errors)}")
    print(f"Total Warnings (4xx or level='warning'): {len(warnings)}")
    
    print("-" * 20)
    print("Issues by Path:")
    for key, occurrences in sorted(error_details.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"\n{key} - {len(occurrences)} occurrences")
        # Print first 3 occurrences to avoid spam
        for msg in occurrences[:3]:
            if msg.strip().endswith(":"): # If message is empty
                 print(f"  {msg} [No explicit message]")
            else:
                 print(f"  {msg}")

if __name__ == "__main__":
    analyze_logs('logs_result.json')
