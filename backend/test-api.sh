#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Backend URL
API_URL=${1:-"http://localhost:3000"}

echo -e "${YELLOW}Testing Ethical Shopper Backend API${NC}"
echo -e "${BLUE}API URL: ${API_URL}${NC}"
echo

# Simulated product identification prompt
PRODUCT_PROMPT='Identify the product on this page and return information in JSON format. The JSON should include: product_name, brand, category, price (if available), and a short description. Make sure the JSON is valid and properly formatted.'

# Simulated HTML content (simplified for testing)
HTML_CONTENT='<html><head><title>Test Product Page</title></head><body><div class="product-info"><h1>Eco-Friendly Water Bottle</h1><p>Brand: EcoHydrate</p><p class="price">$24.99</p><div class="description">Sustainable water bottle made from recycled materials.</div></div></body></html>'

# Simulated product identification (Step 1) result
PRODUCT_JSON='{
  "product_name": "Eco-Friendly Water Bottle",
  "brand": "EcoHydrate",
  "category": "Drinkware",
  "price": "$24.99",
  "description": "Sustainable water bottle made from recycled materials."
}'

# Alternatives prompt with placeholder
ALTERNATIVES_PROMPT='I have identified the following product: [IDENTIFIED_PRODUCT_JSON]

Analyze this product and provide ethical alternatives with the following information:
1. Ethical concerns with the identified product or brand (if any)
2. Three specific alternative products from more ethical brands
3. Brief reasoning for why these alternatives are more ethical
4. Links to purchase the alternatives (if available)

Format the response as a clear list with headings.'

# Test Step 1 - Product Identification with Gemini Flash
echo -e "${GREEN}Testing Step 1: Product Identification${NC}"
echo -e "${BLUE}Using model: gemini-flash-2.0${NC}"

RESPONSE=$(curl -s -X POST "${API_URL}/identify-product" \
  -H "Content-Type: application/json" \
  -d "{
    \"modelName\": \"gemini-flash-2.0\",
    \"basePrompt\": \"$PRODUCT_PROMPT\",
    \"pageContent\": \"$HTML_CONTENT\"
  }")

echo -e "${YELLOW}Response:${NC}"
echo "$RESPONSE" | json_pp
echo

# Test Step 2 - Find Alternatives with OpenAI O3 Mini
echo -e "${GREEN}Testing Step 2: Find Alternatives with OpenAI${NC}"
echo -e "${BLUE}Using model: openai-gpt-o3-mini${NC}"

RESPONSE=$(curl -s -X POST "${API_URL}/find-alternatives" \
  -H "Content-Type: application/json" \
  -d "{
    \"modelName\": \"openai-gpt-o3-mini\",
    \"basePrompt\": \"$ALTERNATIVES_PROMPT\",
    \"productDetails\": $(echo "$PRODUCT_JSON" | sed 's/"/\\"/g')
  }")

echo -e "${YELLOW}Response:${NC}"
echo "$RESPONSE" | json_pp
echo

# Test Step 2 - Find Alternatives with Gemini Grounded
echo -e "${GREEN}Testing Step 2: Find Alternatives with Gemini Grounded${NC}"
echo -e "${BLUE}Using model: gemini-flash-2.0-grounded${NC}"

RESPONSE=$(curl -s -X POST "${API_URL}/find-alternatives" \
  -H "Content-Type: application/json" \
  -d "{
    \"modelName\": \"gemini-flash-2.0-grounded\",
    \"basePrompt\": \"$ALTERNATIVES_PROMPT\",
    \"productDetails\": $(echo "$PRODUCT_JSON" | sed 's/"/\\"/g')
  }")

echo -e "${YELLOW}Response:${NC}"
echo "$RESPONSE" | json_pp
echo

echo -e "${GREEN}API Testing Completed${NC}"