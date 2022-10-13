import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { MyConText } from "@/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";

// const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
// await sleep(5);

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<Post[]> {
    const realLimit = Math.min(50, limit);
    // await sleep(10);
    let pb = getConnection()
      .getRepository(Post)
      .createQueryBuilder("p")
      .orderBy('"createdAt"', "DESC")
      .take(realLimit)
    if (cursor) {
      //cursor is a position and based on that position how many post we want to see using the `limit` variable
      pb.where('"createdAt" < :cursor', {cursor: new Date(parseInt(cursor))})
    }
    return pb.getMany();
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | null> {
    return Post.findOneBy({ id });
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyConText
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("identifier") id: number,
    @Arg("title") title: string
  ): Promise<Post | null> {
    const post = await Post.findOneBy({ id });
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Post.update({ id }, { title });
    }
    return post;
  }

  @Mutation(() => Boolean, { nullable: true })
  async deletePost(@Arg("identifier") id: number): Promise<Boolean> {
    try {
      await Post.delete(id);
    } catch {
      return false;
    }
    return true;
  }
}
