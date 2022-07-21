const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer, gql } = require("apollo-server");
const { toGraphQLTypeDefs } = require("@neo4j/introspector")
const neo4j = require("neo4j-driver");

const driver = neo4j.driver(
    process.env.NEO4J_GRAPHQL_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const sessionFactory = () => driver.session({ defaultAccessMode: neo4j.session.READ })

// We create a async function here until "top level await" has landed
// so we can use async/await
async function main() {
    const readonly = true; // We don't want to expose mutations in this case
    const typeDefs = await toGraphQLTypeDefs(sessionFactory, readonly)

    const neoSchema = new Neo4jGraphQL({ typeDefs, driver });

    const server = new ApolloServer({
        schema: await neoSchema.getSchema(),
        context: ({ req }) => ({ req }),
    });

    neoSchema.getSchema().then((schema) => {
        const server = new ApolloServer({
            schema,
        });

        server.listen().then(({ url }) => {
            console.log(`🚀 Server ready at ${url}`);
        });
    })
}

main();
