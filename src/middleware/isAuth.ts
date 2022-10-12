import { MyConText } from "@/types";
import { MiddlewareFn } from "type-graphql";

export const isAuth: MiddlewareFn<MyConText> = ({context}, next) => {
  if (!context.req.session.userId) {
    throw new Error('not authenticated');
  }

  return next();
}