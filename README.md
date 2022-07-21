# SMILE Neo4j GraphQL Client

## Run

Make sure you have installed the node version and yarn version specified in
[package.json](https://github.com/mskcc/smile-dashboard/blob/master/package.json).

> **Tip:** We recommend that you use [nvm: Node Version Manager](https://github.com/nvm-sh/nvm) and [yvm: Yarn Version Manager](https://yvm.js.org/docs/overview) to switch between versions more easily.

Remove old compiled `node_modules` if it exists

```
rm -rf node_modules
```

To install all app dependencies

```
npm install
```

To run launch the GraphQL client:

```
# set the environment variables you want based on which instance of Neo4j you want to point to
export NEO4J_USERNAME=${NEO4J_USERNAME}
export NEO4J_PASSWORD=${NEO4J_PASSWORD}
export NEO4J_GRAPHQL_URI=bolt://neo4j:7687
npm run start
```

The GraphQL client will be available at `http://localhost:4000` and the Apollo GraphQL can connect at `http://localhost:4000/graphql`
