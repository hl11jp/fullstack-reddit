import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyConText } from "@/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection} from "typeorm";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";

// const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
// await sleep(5);

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

//need to past `Post` into the @Resolver when use @FieldResolver
@Resolver(Post)
export class PostResolver {
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyConText
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);

    const replacements: any[] = [realLimit + 1];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*,
      ${
        req.session.userId
          ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
          : 'null as "voteStatus"'
      }
    from post p
    ${cursor ? `where p."createdAt" < ${req.session.userId ? "$3" : "$2"}` : ""}
    order by p."createdAt" DESC 
    limit $1
    `,
      replacements
    );
    // await sleep(10);
    // let pb = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('p."createdAt"', "DESC")
    //   .take(realLimit + 1);
    // if (cursor) {
    //   //cursor is a position and based on that position how many post we want to see using the `limit` variable
    //   pb.where('p."createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    // }
    // const posts = await pb.getMany();
    // console.log(posts);
    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimit + 1,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | null> {
    return Post.findOne({where: {id}});
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
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyConText
  ): Promise<Post | null> {
    const post = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id, 
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

      if (post.raw.length == 0) throw new Error("not authenticated");

    return post.raw[0];
  }

  @Mutation(() => Boolean, { nullable: true })
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyConText
  ): Promise<Boolean> {
    try {
      //normal way
      await Updoot.delete({ postId: id, userId: req.session.userId });
      await Post.delete({ id, creatorId: req.session.userId });

      //cascade way -- also some code on Updoot entity
      // await Post.delete({id, creatorId: req.session.userId});
    } catch {
      return false;
    }
    return true;
  }

  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  async creator(@Root() post: Post, @Ctx() {userLoader}: MyConText) {
    // return User.findOne({where: {id: post.creatorId}}) this is bad because it has to query a bunch of User
    return await userLoader.load(post.creatorId);
  }

  @FieldResolver(() => Int, {nullable: true})
  async voteStatus(@Root() post: Post, @Ctx() {updootLoader, req}: MyConText) {
    if (!req.session.userId) return null;
    const updoot = await updootLoader.load({postId: post.id, userId: req.session.userId});
    return updoot ? updoot.value : null;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyConText
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;
    const updoot = await Updoot.findOne({ where: { postId, userId } });

    //the user has voted on the post before
    // and they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        update updoot
        set value = $1
        where "postId" = $2 and "userId" = $3
        `,
          [realValue, postId, userId]
        );
        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      //the user never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        insert into updoot("userId", "postId", value)
        values ($1, $2, $3);
        `,
          [userId, postId, value]
        );
        await tm.query(
          `
        update post
        set points = points + $1
        where id = $2;
        `,
          [realValue, postId]
        );
      });
    }
    // await Updoot.insert({
    //   userId,
    //   postId,
    //   value: realValue
    // })

    // combine Updoot.insert
    return true;
  }
}
