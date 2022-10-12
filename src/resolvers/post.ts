import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";
import { MyConText } from "@/types";

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
  async posts(): Promise<Post[]> {
    // await sleep(10);
    return Post.find();
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | null> {
    return Post.findOneBy({ id });
  }

  @Mutation(() => Post)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyConText
  ): Promise<Post> {
    if (!req.session.userId) {
      throw new Error("not authenticated");
    }
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
