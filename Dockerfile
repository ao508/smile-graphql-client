FROM node:16.10.0

WORKDIR /graphql-client
COPY ./ /graphql-client

RUN npm install 
CMD ["node", "index.js"]
