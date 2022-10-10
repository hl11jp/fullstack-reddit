import { User } from "..//entities/User";
import { MyConText } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import argon2 from "argon2";
// import { EntityManager } from "@mikro-orm/postgresql";

declare module "express-session" {
  export interface SessionData {
    userId: number;
  }
}

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => [User])
  users(@Ctx() { em }: MyConText): Promise<User[]> {
    return em.find(User, {});
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyConText) {
    //you are not logged in
    if (!req.session.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    // @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput, if type-graphql can't inferred the type
    @Ctx() { em, req }: MyConText
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "username can not be less than 2",
          },
        ],
      };
    }

    if (options.password.length <= 3) {
      return {
        errors: [
          {
            field: "password",
            message: "length must be greater than 8",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      //if persistAndFlush does not work, do this instead!
      // const [user] = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
      //   username: options.username,
      //   password: hashedPassword,
      //   created_at: new Date(),
      //   updated_at: new Date(),
      // }).returning("*");
      await em.persistAndFlush(user); //if this is fail, the user's id won't be set so the user is null
    } catch (err) {
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "username duplicated",
            },
          ],
        };
      }
    }

    //log the user after register
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyConText
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "username does not exist",
          },
        ],
      };
    }
    const isValidPassword = await argon2.verify(
      user.password,
      options.password
    );
    if (!isValidPassword) {
      return {
        errors: [
          {
            field: "password",
            message: "invalid login",
          },
        ],
      };
    }

    //2:03:06 Sessions Explained
    req.session.userId = user.id;
    console.log(req.session);
    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyConText) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        res.clearCookie('qid', {path: '/', sameSite: 'none', secure:true});
        resolve(true);
      })
    );
  }
}
