FROM apify/actor-node-playwright:latest

# Copy your code into the container
COPY . ./

# Install dependencies only if a package.json exists
RUN if [ -f package.json ]; then npm install --omit=dev; fi

# Run main.js directly instead of "npm start"
CMD ["node", "main.js"]

