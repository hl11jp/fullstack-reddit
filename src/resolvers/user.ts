import argon2 from "argon2";
import { MyConText } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { sendEmail } from "../utils/sendEmail";
import { validateRegister } from "../utils/validateRegister";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { COOKIE_NAME } from "../constants";
// import { EntityManager } from "@mikro-orm/postgresql";
import { getConnection } from "typeorm";
import { v4 } from "uuid";
import { FORGET_PASSWORD_PREFIX } from "../constants";
import { User } from "../entities/User";

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

@Resolver(User)
export class UserResolver {

  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() {req}: MyConText) {
    // this is the current user and it is okay to show them their own email
    if (req.session.userId === user.id) {
      return user.email;
    }
    //current user wants to see someone else email
    return "";
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyConText) {
    //you are not logged in
    if (!req.session.userId) {
      return null;
    }

    return User.findOne({ where: { id: req.session.userId } });
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    // @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput, if type-graphql can't inferred the type
    @Ctx() { req }: MyConText
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) return { errors };

    let user;
    const hashedPassword = await argon2.hash(options.password);
    // const user = em.create(User, {
    //   username: options.username,
    //   password: hashedPassword,
    //   email: options.email,
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    // });
    try {
      /**
       * This was created using mikro-orm
       */
      //if persistAndFlush does not work, do this instead!
      // const [user] = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
      //   username: options.username,
      //   password: hashedPassword,
      //   created_at: new Date(),
      //   updated_at: new Date(),
      // }).returning("*");

      /**
       * This was created using typeorm
       */
      // user = await User.create({username: options.username, password: hashedPassword, email: options.email}).save();
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          email: options.email,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
      // await em.persistAndFlush(user); //if this is fail, the user's id won't be set so the user is null
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
    @Ctx() { req }: MyConText
  ): Promise<UserResponse> {
    const user = await User.findOne({
      where: usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });
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
        res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "none", secure: true });
        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redisClient }: MyConText
  ) {
    const user = await User.findOne({ where: { email } });
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
    @Ctx() { redisClient, req }: MyConText
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword", //name of our field on the frontend
            message: "length must be greater than 3",
          },
        ],
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redisClient.get(key);
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

    const user = await User.findOne({ where: { id: parseInt(userId) } });
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

    await User.update(
      { id: parseInt(userId) },
      {
        password: await argon2.hash(newPassword),
      }
    );

    //clear the token
    await redisClient.del(key);

    //login user after change password
    req.session.userId = user.id;

    return { user };
  }
}
