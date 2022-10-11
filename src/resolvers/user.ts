import { User } from "..//entities/User";
import { MyConText } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import argon2 from "argon2";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
// import { COOKIE_NAME } from "src/constants";
// import { EntityManager } from "@mikro-orm/postgresql";
import { v4 } from "uuid";
import { FORGET_PASSWORD_PREFIX } from "../constants";

declare module "express-session" {
  export interface SessionData {
    userId: number;
  }
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
    const errors = validateRegister(options);
    if (errors) return { errors };

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      email: options.email,
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
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyConText
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );
    if (!user) {
      return {
        errors: [
          {
            // at this point if login screen does not show any error because the field is `username` -- must change it to usernameOrEmail
            field: "usernameOrEmail",
            message: "username does not exist",
          },
        ],
      };
    }
    const isValidPassword = await argon2.verify(user.password, password);
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
        // res.clearCookie(COOKIE_NAME, {path: '/', sameSite: 'none', secure:true}); gave error and I don't know why
        res.clearCookie("qid", { path: "/", sameSite: "none", secure: true });
        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { em, redisClient }: MyConText
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      //the email is not in db
      return true;
    }

    const token = v4();
    await redisClient.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "EX",
      1000 * 60 * 60 * 24 * 3
    ); // 3 days

    await sendEmail(
      email,
      `<a href="http:localhost:3001/change-password/${token}"></a>`
    );
    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { em, redisClient, req }: MyConText
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword", //name of our field on the frontend
            message: "length must be greater than 8",
          },
        ],
      };
    }

    const userId = await redisClient.get(FORGET_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }

    const user = await em.findOne(User, { id: parseInt(userId) });
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }
    user.password = await argon2.hash(newPassword);
    em.persistAndFlush(user);

    //login user after change password
    req.session.userId = user.id;

    return { user };
  }
}
