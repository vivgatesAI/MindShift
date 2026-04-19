import urllib.request
import json
import sys

token = '36df75e9-5eca-44d3-87ed-c9faeda98b01'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}
url = 'https://backboard.railway.app/graphql'

# List projects
query = '{ projects { edges { node { id name } } } }'
req = urllib.request.Request(url, 
    data=json.dumps({'query': query}).encode(),
    headers=headers, method='POST')
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())

print("Projects:")
for edge in result['data']['projects']['edges']:
    print(f"  {edge['node']['name']}: {edge['node']['id']}")

# Find MindShift project
mindshift_id = None
for edge in result['data']['projects']['edges']:
    if edge['node']['name'] == 'MindShift':
        mindshift_id = edge['node']['id']
        break

if mindshift_id:
    print(f"\nMindShift project ID: {mindshift_id}")
    
    # Get project details including services
    detail_query = f'''{{ project(id: "{mindshift_id}") {{ 
        id name 
        services {{ edges {{ node {{ id name }} }} }}
        environments {{ edges {{ node {{ id name }} }} }}
    }} }}'''
    req = urllib.request.Request(url,
        data=json.dumps({'query': detail_query}).encode(),
        headers=headers, method='POST')
    resp = urllib.request.urlopen(req)
    detail = json.loads(resp.read())
    
    print("\nServices:")
    for edge in detail['data']['project']['services']['edges']:
        print(f"  {edge['node']['name']}: {edge['node']['id']}")
    
    print("\nEnvironments:")
    for edge in detail['data']['project']['environments']['edges']:
        print(f"  {edge['node']['name']}: {edge['node']['id']}")
else:
    print("MindShift project not found!")