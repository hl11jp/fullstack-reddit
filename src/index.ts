import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import {createConnection} from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";
import { Updoot } from "./entities/Updoot";

//rerun
const main = async () => {
  const conn = await createConnection({
    type: 'postgres',
    'database': 'lireddit2',
    username: 'postgres',
    password: 'postgres',
    logging: true,
    synchronize: true, //auto create table so don't need to run migration,
    migrations: [path.join(__dirname, './migrations/*')],
    entities: [Post, User, Updoot]
  })

  await conn.runMigrations();


  const app = express();
  const session = require("express-session");
  let RedisStore = require("connect-redis")(session);
  // const { createClient } = require("redis");
  let redisClient = new Redis();
  // redisClient.connect().catch(console.error);
  app.set('trust proxy', true);
  app.use(
    session({
      name: COOKIE_NAME,
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
      req,
      res,
      redisClient
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