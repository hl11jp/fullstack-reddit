import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Updoot } from "./Updoot";
import { User } from "./User";

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

  @Field()
  @Column()
  creatorId: number;

  @Field()
  @ManyToOne(() => User, user => user.posts)
  creator: User;

  @Field()
  @Column()
  text!: string;

  @Field()
  @Column({type: "int", default: 0})
  points!: number;

  @OneToMany(() => Updoot, updoot => updoot.post)
  updoots: Updoot[]

}