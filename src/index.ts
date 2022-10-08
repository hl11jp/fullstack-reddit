import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

const main = async () => {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up();

  const app = express();
  const session = require("express-session");
  let RedisStore = require("connect-redis")(session);
  const { createClient } = require("redis");
  let redisClient = createClient({ legacyMode: true });
  redisClient.connect().catch(console.error);
  app.set('trust proxy', true);
  app.use(
    session({
      name: "qid",
      store: new RedisStore({ client: redisClient as any, disableTouch: true }),
      secret: "keyboard",
      saveUninitialized: false,
      resave: true,
      cookie: {
        path: "/",
        sameSite: "none", // csrf
        // secure: __prod__, //cookie only works in https
        secure: true,
        expires: 60 * 1000
      },
    })
  );

  app.get("/", (_, res) => {
    res.send("hello");
  });

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    //accessing cookie resolver by passing req, res
    context: ({ req, res }) => ({
      em: orm.em,
      req,
      res,
    }),
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app, cors: {credentials: true, origin: ["https://studio.apollographql.com", "http://localhost:3001"]} });

  app.listen(3000, () => {
    console.log("listening on port 3000...");
  });
  // const post = orm.em.create(Post, {title: 'omg', createdAt: new Date(), updatedAt: new Date()});
  // const post = orm.em.create(Post, {title: 'bro'}); //this will auto create Date
  // await orm.em.persistAndFlush(post);

  // const posts = await orm.em.find(Post, {});
  // console.log(posts);
};

main();