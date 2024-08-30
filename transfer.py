import pymysql
from pymongo import MongoClient

# MySQL Database Configuration
mysql_config = {
    'host': '192.155.100.47',
    'user': 'youtube',
    'password': '!qR%xf|L3@',
    'database': 'instagram'
}

# MongoDB Configuration
mongo_client = MongoClient("mongodb://admin:1SmUp8RmpzWrJUU46Zmz@192.155.100.53:27017/admin")
mongo_db = mongo_client.get_database("admin")  # Change this to your target database if needed
mongo_collection = mongo_db.get_collection("countries_cities")  # Create a new collection

# Connect to MySQL
mysql_conn = pymysql.connect(**mysql_config)
mysql_cursor = mysql_conn.cursor(pymysql.cursors.DictCursor)

# Fetch all countries and their cities from MySQL
mysql_cursor.execute("SELECT * FROM world")
rows = mysql_cursor.fetchall()

# Prepare data for MongoDB
data = {}
for row in rows:
    country = row['country']
    city = row['city']

    if country not in data:
        data[country] = []

    data[country].append(city)

# Insert data into MongoDB
for country, cities in data.items():
    mongo_collection.update_one(
        {'country': country},
        {'$set': {'cities': cities}},
        upsert=True  # This will create a new document if it doesn't exist
    )

# Close MySQL connection
mysql_cursor.close()
mysql_conn.close()

# Close MongoDB connection
mongo_client.close()

print("Data transfer from MySQL to MongoDB is complete.")
