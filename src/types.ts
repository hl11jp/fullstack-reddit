import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core"

export type MyConText = {
  em: EntityManager<IDatabaseDriver<Connection>>
}