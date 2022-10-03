import { Post } from "../entities/Post";
import { MyConText } from "src/types";
import { Ctx, Query, Resolver } from "type-graphql";

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(@Ctx() ctx: MyConText): Promise<Post[]> {
    return ctx.em.find(Post, {})
  }
}