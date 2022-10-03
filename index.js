const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer, gql } = require("apollo-server-express");
const { toGraphQLTypeDefs } = require("@neo4j/introspector");
const neo4j = require("neo4j-driver");
const { connect, StringCodec } = require("nats");
var PropertiesReader = require("properties-reader");
var properties = new PropertiesReader("./env/application.properties");
const http = require("http");
const bodyParser = require("body-parser");
const express = require("express");
const {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault
} = require("apollo-server-core");
const { OGM } = require("@neo4j/graphql-ogm");

// neo4j connection properties
const neo4j_graphql_uri = properties.get("db.neo4j_graphql_uri");
const neo4j_username = properties.get("db.neo4j_username");
const neo4j_password = properties.get("db.neo4j_password");

// nats connection properties
const nats_username = properties.get("conn.nats_username");
const nats_password = properties.get("conn.nats_password");
const nats_key_pem = properties.get("conn.nats_key_pem");
const nats_cert_pem = properties.get("conn.nats_cert_pem");
const nats_ca_pem = properties.get("conn.nats_ca_pem");
const nats_url = properties.get("conn.nats_url");

const tlsOptions = {
  keyFile: nats_key_pem,
  certFile: nats_cert_pem,
  caFile: nats_ca_pem
};

const natsConnProperties = {
  servers: [nats_url, "nats://localhost:4222"],
  user: nats_username,
  pass: nats_password,
  tls: tlsOptions
};

const sc = StringCodec();

async function printMsgs(s) {
  let subj = s.getSubject();
  console.log(`listening for ${subj}`);
  const c = 13 - subj.length;
  const pad = "".padEnd(c);
  for await (const m of s) {
    console.log(
      `[${subj}]${pad} #${s.getProcessed()} - ${m.subject} ${
        m.data ? " " + sc.decode(m.data) : ""
      }`
    );
  }
}



const mutDefs = gql`
mutation UpdateRequests($update: RequestUpdateInput, $where: RequestWhere) {
  updateRequests(update: $update, where: $where) {
    requests {
      smileRequestId
      igoRequestId
      dataStatus
    }
  }
}
`;

var nc = null;
async function establishConnection() {
  try {
    const natsConn = await connect(natsConnProperties);
    nc = natsConn;
    console.log("Connected to server: ");
    console.log(natsConn.getServer());

    // setting up subscriber
    console.log("Setting up subscriber");
    const sub = natsConn.subscribe("MDB_STREAM.validator.request-filter");
    (async () => {
      for await (const m of sub) {
        console.log(`[${sub.getProcessed()}]: ${sc.decode(m.data)}`);
      }
      // TODO: SET REQUEST STATE TO READY
    })();

    const message = JSON.stringify({ requestId: "08944_B" });
    console.log("publishing message", message);
    natsConn.publish(
      "MDB_STREAM.server.consistency-checker.igo-new-request",
      sc.encode(message)
    );
    // printMsgs(sub);
  } catch (err) {
    console.log(
      `error connecting to ${JSON.stringify(natsConnProperties)}`,
      err
    );
  }
}

const driver = neo4j.driver(
  neo4j_graphql_uri,
  neo4j.auth.basic(neo4j_username, neo4j_password)
);

const sessionFactory = () =>
  driver.session({ defaultAccessMode: neo4j.session.WRITE });

  // const resolvers = {
  //   Mutation: {
  //     updateRequestStatus: async (_source, {requestId, dataStatus}) => {
  //       const { x } = await Request.update({
  //         where: {
  //           "igoRequestId": requestId
  //         },
  //         update: {
  //           "dataStatus": dataStatus
  //         }
  //       });
  //       console.log(x)
  //       return x;
  //     } 
  //   }
  // }

// We create a async function here until "top level await" has landed
// so we can use async/await
async function main() {
  establishConnection();
  const typeDefs = await toGraphQLTypeDefs(sessionFactory, false);
  const neoSchema = new Neo4jGraphQL({ typeDefs, driver });
  const ogm = new OGM({typeDefs, driver});
  ogm.init();
  const Request = ogm.model("Request");

  const app = express();

  
  app.use(bodyParser.urlencoded({ extended: true }));

  // endpoint for updating status of a given request
  app.post("/requestStatus", async (req,res) => {
    // cant seem to be able to query successfuly for some reason even though the 
    // status in the database is being updated to whatever I'm sending to the api
    // see docs here https://neo4j.com/docs/graphql-manual/current/ogm/examples/custom-resolvers/
    console.log("querying by: ", req.body.requestId);
    const { r } = await Request.find({
      where: {
        "igoRequestId": req.body.requestId
      }
    });
    

    const { x } = await Request.update({
      where: {
        "igoRequestId": req.body.requestId
      },
      update: {
        "dataStatus": req.body.dataStatus
      }
    });
    return res.sendStatus(200);
  })

  const httpServer = http.createServer(app);
  const server = new ApolloServer({
    schema: await neoSchema.getSchema(),
    context: ({ req }) => ({ req }),
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true })
    ]
  });
  

  neoSchema.getSchema().then(schema => {
    const server = new ApolloServer({
      schema
    });
  });
  await server.start();
  server.applyMiddleware({ app });
  await new Promise(resolve => httpServer.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}

main();
