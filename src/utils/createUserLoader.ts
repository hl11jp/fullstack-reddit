import { User } from "../entities/User";
import DataLoader from "dataloader";

// [1, 4, 7, 10]
// return [{id: 1, username: 'khue'}, {}, {}, {}] -- object of users
export const createUserLoader = () =>
  new DataLoader<number, User>(async (userIds) => {
    const users = await User.findByIds(userIds as number[]);
    const userIdToUser: Record<number, User> = {};
    users.forEach((u) => {
      userIdToUser[u.id] = u;
    });

    return userIds.map((userId) => userIdToUser[userId]);
  });
