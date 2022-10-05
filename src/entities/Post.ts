import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Field, Int, ObjectType } from "type-graphql";

//what is migration 1:13:26
//compare db to this Post class then create a sql to match the db

@ObjectType() //convert orm to graphql object
@Entity()
export class Post {
  @Field(() => Int) // you can specify type manually as a callback
  @PrimaryKey()
  id!: number;

  @Field(() => String)
  @Property({type: "date"})
  createdAt = new Date();

  @Field(() => String)
  @Property({type: "date", onUpdate: () => new Date()})
  updatedAt = new Date();

  // Comment field to make the schema not expose
  @Field(() => String)
  @Property({type: "text"})
  title!: string;
}