import json

# Load the JSON file
file_path = r"C:/Users/ASUS/OneDrive/Documents/influenceedb.brandsdb.json"
with open(file_path, 'r') as file:
    data = json.load(file)

# Process and structure the data
structured_data = {}
for brand in data:
    structured_data[brand['brand']] = {
        "brand": brand.get('brand', 'Unknown'),
        "about": brand.get('about', 'Description not available.'),
        "categories": brand.get('categories', []),
        "social_links": {
            "website": brand.get('social_links', {}).get('website', ''),
            "facebook": brand.get('social_links', {}).get('facebook', ''),
            "instagram": brand.get('social_links', {}).get('instagram', ''),
            "twitter": brand.get('social_links', {}).get('twitter', '')
        },
        "influencer_demographics": {
            "age_group": brand.get('influencer_demographics', {}).get('age_group', {}),
            "gender": brand.get('influencer_demographics', {}).get('gender', {})
        },
        "city_distribution": brand.get('city_distribution', [])
    }

# Print the structured data
print(json.dumps(structured_data, indent=4))



from diagrams import Diagram, Cluster
from diagrams.programming.language import React
from diagrams.programming.framework import Flask
from diagrams.onprem.database import Mysql
from diagrams.onprem.vcs import Github
from diagrams.onprem.client import User
from diagrams.onprem.compute import Server

with Diagram("Work Management System Architecture", show=True, direction="LR") as diag:
    user = User("User")

    with Cluster("Client Interface"):
        web_app = React("Web Application")
    
    with Cluster("Backend API"):
        backend = Flask("Backend API")
        timer_service = Server("Timer Service")

    with Cluster("Database"):
        db = Mysql("Database")
    
    github = Github("GitHub")

    user >> web_app >> backend
    backend >> db
    backend >> github
    backend >> timer_service
    user >> github
    timer_service >> db

diag
