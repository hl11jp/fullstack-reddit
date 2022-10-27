import { Request, Response } from "express";
import {Redis} from "ioredis";
import {createUserLoader} from "./utils/createUserLoader";

export type MyConText = {
  req: Request;
  res: Response;
  redisClient: Redis;
  userLoader: ReturnType<typeof createUserLoader>
};
