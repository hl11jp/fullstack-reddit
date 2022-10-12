import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

//what is migration 1:13:26
//compare db to this Post class then create a sql to match the db

@ObjectType() //convert orm to graphql object
@Entity()
export class Post extends BaseEntity{
  @Field(() => Int) // you can specify type manually as a callback
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  // Comment field to make the schema not expose
  @Field(() => String)
  @Column()
  title!: string;
}