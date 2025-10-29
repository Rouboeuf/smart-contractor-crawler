FROM apify/actor-node-playwright:latest

# Copy everything
COPY . ./

# Install dependencies
RUN npm install --omit=dev

# Run the scraper
CMD ["npm", "start"]
