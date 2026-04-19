import json, sys
data = json.load(sys.stdin)
for env in data['environments']['edges']:
    for s in env['node']['serviceInstances']['edges']:
        n = s['node']
        status = n.get('latestDeployment', {}).get('status', 'unknown') if n.get('latestDeployment') else 'none'
        print(f"{n['serviceName']}: {status}")