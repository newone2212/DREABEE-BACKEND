import sys
import json
import numpy as np
import joblib
import pandas as pd

# Load the trained model
model_path = 'cities_model/city_percentage_model.pkl'
model = joblib.load(model_path)

# Load the encoder used during training
encoder_path = 'cities_model/encoder.pkl'
encoder = joblib.load(encoder_path)

# Function to introduce randomness and normalize percentages unevenly
def uneven_normalize(predictions, total_percentage):
    randomness = np.random.uniform(0.8, 1.2, size=len(predictions))
    predictions = predictions * randomness
    total_pred = sum(predictions)
    normalized_percentages = [p / total_pred * total_percentage for p in predictions]
    difference = total_percentage - sum(normalized_percentages)
    normalized_percentages[-1] += difference
    return normalized_percentages

# Check if file paths were passed
if len(sys.argv) < 3:
    print("Missing file paths for input and output data")
    sys.exit(1)

input_file_path = sys.argv[1]
output_file_path = sys.argv[2]

# Load input data from the file
try:
    with open(input_file_path, 'r') as input_file:
        input_data = json.load(input_file)
except Exception as e:
    print(f"Error reading input file: {e}")
    sys.exit(1)

# Extract the data from the input JSON
country = input_data.get('country')
country_percentage = input_data.get('countryPercentage')
brand_category = input_data.get('brandCategory')
brand_name = input_data.get('brandName')  # Extract the brand name
cities = input_data.get('cities')

# Ensure that all required data is present
if not (country and country_percentage and brand_category and brand_name and cities):
    print("Missing required input data")
    sys.exit(1)

# Create a DataFrame for the prediction
new_data = pd.DataFrame({
    'Brand': [brand_name] * len(cities),  # Use the brand name here
    'Brand Category': [brand_category] * len(cities),
    'Country': [country] * len(cities),
    'City': cities,
    'Country Percentage': [country_percentage] * len(cities)
})

# Encode the new data
encoded_new_data = encoder.transform(new_data)

# Predict city percentages
predicted_city_percentages = model.predict(encoded_new_data)

# Apply uneven normalization
normalized_city_percentages = uneven_normalize(predicted_city_percentages, total_percentage=country_percentage)

# Prepare the output
output = [{'city': city, 'percentage': percentage} for city, percentage in zip(cities, normalized_city_percentages)]

# Write output data to the output file
try:
    with open(output_file_path, 'w') as output_file:
        json.dump(output, output_file)
except Exception as e:
    print(f"Error writing output file: {e}")
    sys.exit(1)

# Ensure script completion
sys.exit(0)
