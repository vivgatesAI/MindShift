import urllib.request
import json

# Try the Railway API with different auth approaches
token = '36df75e9-5eca-44d3-87ed-c9faeda98b01'

# Method 1: Try REST API endpoints
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Try the projects endpoint
try:
    req = urllib.request.Request('https://railway.app/api/v1/projects',
        headers=headers)
    resp = urllib.request.urlopen(req)
    print("REST API:", resp.read().decode()[:500])
except Exception as e:
    print(f"REST API failed: {e}")

# Method 2: Try GraphQL with different token format
try:
    url = 'https://backboard.railway.app/graphql'
    headers2 = {
        'Authorization': token,
        'Content-Type': 'application/json'
    }
    query = '{ me { id name email } }'
    req = urllib.request.Request(url,
        data=json.dumps({'query': query}).encode(),
        headers=headers2, method='POST')
    resp = urllib.request.urlopen(req)
    print("GraphQL:", resp.read().decode()[:500])
except Exception as e:
    print(f"GraphQL failed: {e}")