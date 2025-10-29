FROM apify/actor-node-playwright:latest

# Copy all files into container
COPY . ./

# Force bypass npm scripts — we’ll run main.js directly
CMD ["node", "main.js"]


