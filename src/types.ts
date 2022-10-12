import { Request, Response } from "express";
import {Redis} from "ioredis";

export type MyConText = {
  req: Request;
  res: Response;
  redisClient: Redis;
};
