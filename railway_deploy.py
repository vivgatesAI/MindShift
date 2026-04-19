import urllib.request
import json
import sys

token = '36df75e9-5eca-44d3-87ed-c9faeda98b01'
project_id = '47fc8108-136d-4ea6-bb7a-3591a2e38b2b'
url = 'https://backboard.railway.app/graphql'

def gql(query, variables=None):
    data = {'query': query}
    if variables:
        data['variables'] = variables
    req = urllib.request.Request(url,
        data=json.dumps(data).encode(),
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }, method='POST')
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()[:500]}")
        return None

# Step 1: Create the web service
print("Creating web service...")
result = gql("""
mutation CreateService($projectId: String!, $name: String!) {
  serviceCreate(projectId: $projectId, name: $name) {
    id
    name
  }
}
""", {"projectId": project_id, "name": "MindShift-web"})

if result:
    print(f"Result: {json.dumps(result, indent=2)}")
    if 'data' in result and result['data'].get('serviceCreate'):
        service_id = result['data']['serviceCreate']['id']
        print(f"Service created: {service_id}")
        
        # Step 2: Connect GitHub repo
        print("\\nConnecting GitHub repo...")
        result2 = gql("""
mutation ConnectRepo($serviceId: String!, $repo: String!) {
  serviceConnectRepo(serviceId: $serviceId, repo: $repo) {
    id
    name
  }
}
""", {"serviceId": service_id, "repo": "vivgatesAI/MindShift"})
        print(f"Repo result: {json.dumps(result2, indent=2)}")
    else:
        print("Service creation may have failed")
else:
    print("Failed to create service")